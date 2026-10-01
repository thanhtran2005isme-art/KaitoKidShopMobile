import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { toBoolean, toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { ChatBotService } from "./chat-bot.service.js";
import {
  CHAT_SENDER,
  CHAT_STATUS,
  type ChatActor,
  type ChatAttachment,
  type ChatIdentity,
  type ConversationRow,
  type MessageRow,
  type QuickReply,
} from "./chat.types.js";

const windows = new Map<number, number[]>();

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: ChatBotService,
  ) {}

  async getOrCreate(
    who: ChatIdentity,
    productContextId: number | null,
  ) {
    if (who.userId === null && !who.guestId) {
      throw new BadRequestException({
        message: "Thiếu định danh khách (guestId).",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = who.userId !== null
        ? await tx.$queryRawUnsafe<ConversationRow[]>(
            `${this.conversationSelect()}
             WHERE NguoiDungId = ?
               AND TrangThai <> 'closed'
             ORDER BY ThoiGianTinCuoi DESC
             LIMIT 1
             FOR UPDATE`,
            who.userId,
          )
        : await tx.$queryRawUnsafe<ConversationRow[]>(
            `${this.conversationSelect()}
             WHERE MaKhachVangLai = ?
               AND TrangThai <> 'closed'
             ORDER BY ThoiGianTinCuoi DESC
             LIMIT 1
             FOR UPDATE`,
            who.guestId,
          );

      let row = rows[0];
      if (!row) {
        const now = new Date();
        await tx.$executeRawUnsafe(
          `INSERT INTO CuocHoiThoai
             (NguoiDungId, MaKhachVangLai, TenHienThi, TrangThai,
              NhanVienId, SanPhamNguCanhId, TinNhanCuoi,
              ThoiGianTinCuoi, SoTinChuaDocKhach, SoTinChuaDocNV,
              NgayTao, NgayCapNhat)
           VALUES (?, ?, ?, 'bot', NULL, ?, NULL, ?, 0, 0, ?, NULL)`,
          who.userId,
          who.userId === null ? who.guestId : null,
          who.displayName,
          productContextId,
          now,
          now,
        );
        const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
          "SELECT LAST_INSERT_ID() AS id",
        );
        row = (await this.getConversationWithClient(
          tx,
          toNumber(ids[0]?.id),
        ))!;
      } else if (
        productContextId !== null &&
        toNumber(row.productContextId) !== productContextId
      ) {
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SanPhamNguCanhId = ?, NgayCapNhat = ?
           WHERE Id = ?`,
          productContextId,
          new Date(),
          toNumber(row.id),
        );
        row.productContextId = productContextId;
      }

      return this.mapConversation(row);
    });
  }

  async getConversation(id: number) {
    const row = await this.getConversationWithClient(this.prisma, id);
    return row ? this.mapConversation(row) : null;
  }

  async getHistory(
    who: ChatIdentity,
    conversationId: number,
    take = 50,
    beforeId = 0,
  ) {
    const conv = await this.getConversationWithClient(
      this.prisma,
      conversationId,
    );
    if (!conv) {
      throw new NotFoundException({
        message: "Không tìm thấy phiên hội thoại.",
      });
    }
    if (!this.ownedBy(conv, who)) throw new ForbiddenException();

    const safeTake = Math.max(1, Math.min(200, take || 50));
    const beforeSql = beforeId > 0 ? "AND Id < ?" : "";
    const values = beforeId > 0
      ? [conversationId, beforeId]
      : [conversationId];
    const rows = await this.prisma.$queryRawUnsafe<MessageRow[]>(
      `SELECT * FROM (
         SELECT Id AS id, CuocHoiThoaiId AS conversationId,
                LoaiNguoiGui AS senderType, NguoiGuiId AS senderId,
                NoiDung AS content, LoaiDinhKem AS attachmentType,
                DinhKemId AS attachmentRefId, DinhKemJson AS attachmentData,
                DaDoc AS isRead, NgayTao AS createdAt
         FROM TinNhan
         WHERE CuocHoiThoaiId = ? ${beforeSql}
         ORDER BY Id DESC
         LIMIT ${safeTake}
       ) recent
       ORDER BY id ASC`,
      ...values,
    );
    return rows.map((row) => this.mapMessage(row));
  }

  async addCustomerMessage(
    who: ChatIdentity,
    conversationId: number,
    text: string,
    attachment: ChatAttachment | null,
  ) {
    const content = text.trim();
    if (!content) {
      throw new BadRequestException({ message: "Nội dung trống." });
    }
    this.enforceRateLimit(conversationId);

    const first = await this.prisma.$transaction(async (tx) => {
      const conv = await this.lockConversation(tx, conversationId);
      if (!conv) {
        throw new NotFoundException({
          message: "Không tìm thấy phiên hội thoại.",
        });
      }
      if (!this.ownedBy(conv, who)) throw new ForbiddenException();

      const now = new Date();
      if (conv.status === CHAT_STATUS.CLOSED) {
        conv.status = CHAT_STATUS.BOT;
        conv.assignedStaffId = null;
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET TrangThai='bot', NhanVienId=NULL, NgayCapNhat=?
           WHERE Id=?`,
          now,
          conversationId,
        );
      }

      const msgId = await this.insertMessage(tx, {
        conversationId,
        senderType: CHAT_SENDER.CUSTOMER,
        senderId: who.userId,
        content,
        attachment,
        now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET ThoiGianTinCuoi=?, TinNhanCuoi=?,
             SoTinChuaDocNV=SoTinChuaDocNV+1, NgayCapNhat=?
         WHERE Id=?`,
        now,
        this.preview(content),
        now,
        conversationId,
      );

      const message = await this.getMessageWithClient(tx, msgId);
      return {
        conv,
        customerMessage: this.mapMessage(message!),
      };
    });

    let botMessage = null;
    let handedOff = false;
    if (
      first.conv.status === CHAT_STATUS.BOT ||
      first.conv.status === CHAT_STATUS.WAITING
    ) {
      const recentRows = await this.recentHistory(conversationId, 10);
      let botFailCount = 0;
      for (let i = recentRows.length - 1; i >= 0; i--) {
        if (recentRows[i].senderType === CHAT_SENDER.BOT) botFailCount += 1;
        else if (recentRows[i].senderType === CHAT_SENDER.CUSTOMER) break;
      }

      const reply = await this.bot.respond({
        conversationId,
        who,
        userText: content,
        productContextId:
          first.conv.productContextId === null
            ? null
            : toNumber(first.conv.productContextId),
        recentHistory: recentRows,
        botFailCount,
      });

      botMessage = await this.prisma.$transaction(async (tx) => {
        const conv = await this.lockConversation(tx, conversationId);
        if (!conv) return null;
        // Agent có thể claim trong lúc bot đang xử lý; không chen bot vào phiên agent.
        if (conv.status === CHAT_STATUS.AGENT) return null;

        const now = new Date();
        const msgId = await this.insertMessage(tx, {
          conversationId,
          senderType: CHAT_SENDER.BOT,
          senderId: null,
          content: reply.text,
          attachment: reply.attachment,
          now,
        });
        const nextStatus =
          reply.shouldHandoff && conv.status === CHAT_STATUS.BOT
            ? CHAT_STATUS.WAITING
            : conv.status;
        handedOff = nextStatus === CHAT_STATUS.WAITING &&
          conv.status !== CHAT_STATUS.WAITING;
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET TrangThai=?, ThoiGianTinCuoi=?, TinNhanCuoi=?,
               SoTinChuaDocKhach=SoTinChuaDocKhach+1, NgayCapNhat=?
           WHERE Id=?`,
          nextStatus,
          now,
          this.preview(reply.text),
          now,
          conversationId,
        );
        const row = await this.getMessageWithClient(tx, msgId);
        return row
          ? this.mapMessage(row, reply.quickReplies)
          : null;
      });
    }

    return {
      customerMessage: first.customerMessage,
      botMessage,
      handedOff,
    };
  }

  async addAgentMessage(
    staffId: number,
    conversationId: number,
    text: string,
    attachment: ChatAttachment | null,
  ) {
    const content = text.trim();
    if (!content) {
      throw new BadRequestException({ message: "Nội dung trống." });
    }

    return this.prisma.$transaction(async (tx) => {
      const conv = await this.lockConversation(tx, conversationId);
      if (!conv) {
        throw new NotFoundException({
          message: "Không tìm thấy phiên hội thoại.",
        });
      }
      const now = new Date();
      const assigned =
        conv.assignedStaffId === null
          ? staffId
          : toNumber(conv.assignedStaffId);
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai='agent', NhanVienId=?, NgayCapNhat=?
         WHERE Id=?`,
        assigned,
        now,
        conversationId,
      );
      const msgId = await this.insertMessage(tx, {
        conversationId,
        senderType: CHAT_SENDER.AGENT,
        senderId: staffId,
        content,
        attachment,
        now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET ThoiGianTinCuoi=?, TinNhanCuoi=?,
             SoTinChuaDocKhach=SoTinChuaDocKhach+1, NgayCapNhat=?
         WHERE Id=?`,
        now,
        this.preview(content),
        now,
        conversationId,
      );
      return this.mapMessage(
        (await this.getMessageWithClient(tx, msgId))!,
      );
    });
  }

  async requestHandoff(
    who: ChatIdentity,
    conversationId: number,
    reason?: string | null,
  ) {
    if (!(await this.isOwner(conversationId, who))) {
      throw new ForbiddenException();
    }
    return this.prisma.$transaction(async (tx) => {
      const conv = await this.lockConversation(tx, conversationId);
      if (!conv || conv.status === CHAT_STATUS.AGENT) return null;
      const now = new Date();
      const text =
        "Yêu cầu của bạn đã được chuyển tới nhân viên hỗ trợ. Vui lòng chờ trong giây lát, nhân viên sẽ phản hồi sớm nhất có thể nhé! 🙋";
      const msgId = await this.insertMessage(tx, {
        conversationId,
        senderType: CHAT_SENDER.BOT,
        senderId: null,
        content: reason?.trim() ? `${text}\nLý do: ${reason.trim()}` : text,
        attachment: null,
        now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai='waiting', ThoiGianTinCuoi=?, TinNhanCuoi=?,
             SoTinChuaDocKhach=SoTinChuaDocKhach+1, NgayCapNhat=?
         WHERE Id=?`,
        now,
        this.preview(text),
        now,
        conversationId,
      );
      return this.mapMessage(
        (await this.getMessageWithClient(tx, msgId))!,
      );
    });
  }

  async claim(staffId: number, conversationId: number, staffName?: string) {
    return this.prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET NhanVienId=?, TrangThai='agent', NgayCapNhat=?
         WHERE Id=?
           AND TrangThai <> 'agent'
           AND (NhanVienId IS NULL OR TrangThai='waiting')`,
        staffId,
        new Date(),
        conversationId,
      );
      if (affected === 0) {
        return { success: false, systemMessage: null };
      }
      const name = staffName?.trim() || "Nhân viên hỗ trợ";
      const text =
        `Bạn đã được kết nối với ${name}. Nhân viên sẽ hỗ trợ bạn ngay bây giờ! 👩‍💼`;
      const now = new Date();
      const msgId = await this.insertMessage(tx, {
        conversationId,
        senderType: CHAT_SENDER.BOT,
        senderId: null,
        content: text,
        attachment: null,
        now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET ThoiGianTinCuoi=?, TinNhanCuoi=?,
             SoTinChuaDocKhach=SoTinChuaDocKhach+1, NgayCapNhat=?
         WHERE Id=?`,
        now,
        this.preview(text),
        now,
        conversationId,
      );
      return {
        success: true,
        systemMessage: this.mapMessage(
          (await this.getMessageWithClient(tx, msgId))!,
        ),
      };
    });
  }

  async closeByCustomer(who: ChatIdentity, conversationId: number) {
    if (!(await this.isOwner(conversationId, who))) {
      throw new ForbiddenException();
    }
    return this.prisma.$transaction(async (tx) => {
      const conv = await this.lockConversation(tx, conversationId);
      if (!conv) return false;
      if (conv.status === CHAT_STATUS.CLOSED) return true;
      const text =
        "Phiên trò chuyện đã kết thúc. Cảm ơn bạn đã liên hệ KaitoKid Shop! 💖";
      const now = new Date();
      await this.insertMessage(tx, {
        conversationId,
        senderType: CHAT_SENDER.BOT,
        senderId: null,
        content: text,
        attachment: null,
        now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai='closed', ThoiGianTinCuoi=?,
             TinNhanCuoi=?, NgayCapNhat=?
         WHERE Id=?`,
        now,
        this.preview(text),
        now,
        conversationId,
      );
      return true;
    });
  }

  async close(conversationId: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE CuocHoiThoai
       SET TrangThai='closed', NgayCapNhat=?
       WHERE Id=?`,
      new Date(),
      conversationId,
    );
  }

  async listForCustomer(who: ChatIdentity) {
    if (who.userId === null && !who.guestId) return [];
    const rows = who.userId !== null
      ? await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          `${this.conversationSelect()}
           WHERE NguoiDungId=?
           ORDER BY ThoiGianTinCuoi DESC LIMIT 50`,
          who.userId,
        )
      : await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          `${this.conversationSelect()}
           WHERE MaKhachVangLai=?
           ORDER BY ThoiGianTinCuoi DESC LIMIT 50`,
          who.guestId,
        );
    return rows.map((r) => this.mapConversation(r));
  }

  async listForAgent(input: {
    status?: string | null;
    page?: number;
    pageSize?: number;
    assignedStaffId?: number | null;
  }) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (input.status?.trim()) {
      where.push("TrangThai=?");
      values.push(input.status.trim());
    }
    if (input.assignedStaffId) {
      where.push("NhanVienId=?");
      values.push(input.assignedStaffId);
    }
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 20));
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      `SELECT COUNT(*) AS total FROM CuocHoiThoai ${clause}`,
      ...values,
    );
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()}
       ${clause}
       ORDER BY ThoiGianTinCuoi DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ...values,
    );
    return {
      items: rows.map((r) => this.mapConversation(r)),
      totalCount: toNumber(totals[0]?.total),
      page,
      pageSize,
      totalPages: Math.ceil(
        toNumber(totals[0]?.total) / pageSize,
      ),
    };
  }

  async markRead(conversationId: number, actor: ChatActor) {
    await this.prisma.$transaction(async (tx) => {
      if (actor === "Customer") {
        await tx.$executeRawUnsafe(
          `UPDATE TinNhan
           SET DaDoc=1
           WHERE CuocHoiThoaiId=? AND LoaiNguoiGui <> 'customer' AND DaDoc=0`,
          conversationId,
        );
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SoTinChuaDocKhach=0, NgayCapNhat=?
           WHERE Id=?`,
          new Date(),
          conversationId,
        );
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE TinNhan
           SET DaDoc=1
           WHERE CuocHoiThoaiId=? AND LoaiNguoiGui='customer' AND DaDoc=0`,
          conversationId,
        );
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SoTinChuaDocNV=0, NgayCapNhat=?
           WHERE Id=?`,
          new Date(),
          conversationId,
        );
      }
    });
  }

  async isOwner(conversationId: number, who: ChatIdentity) {
    const conv = await this.getConversationWithClient(
      this.prisma,
      conversationId,
    );
    return Boolean(conv && this.ownedBy(conv, who));
  }

  async sweepIdle(idleMinutes: number) {
    const threshold = new Date(Date.now() - idleMinutes * 60_000);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      `SELECT Id AS id
       FROM CuocHoiThoai
       WHERE TrangThai IN ('waiting','agent')
         AND ThoiGianTinCuoi < ?
       ORDER BY Id`,
      threshold,
    );
    let count = 0;
    for (const row of rows) {
      const id = toNumber(row.id);
      const closed = await this.prisma.$transaction(async (tx) => {
        const conv = await this.lockConversation(tx, id);
        if (
          !conv ||
          (conv.status !== CHAT_STATUS.WAITING &&
            conv.status !== CHAT_STATUS.AGENT) ||
          new Date(conv.lastMessageAt).getTime() >= threshold.getTime()
        ) {
          return false;
        }
        const now = new Date();
        const text =
          "Hội thoại được tạm đóng do không có hoạt động. Bạn nhắn tiếp bất cứ lúc nào để mở lại nhé!";
        await this.insertMessage(tx, {
          conversationId: id,
          senderType: CHAT_SENDER.BOT,
          senderId: null,
          content: text,
          attachment: null,
          now,
        });
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET TrangThai='closed', ThoiGianTinCuoi=?,
               TinNhanCuoi=?, NgayCapNhat=?
           WHERE Id=?`,
          now,
          this.preview(text),
          now,
          id,
        );
        return true;
      });
      if (closed) count += 1;
    }
    return count;
  }

  private async insertMessage(
    tx: SqlClient,
    input: {
      conversationId: number;
      senderType: string;
      senderId: number | null;
      content: string;
      attachment: ChatAttachment | null;
      now: Date;
    },
  ) {
    await tx.$executeRawUnsafe(
      `INSERT INTO TinNhan
         (CuocHoiThoaiId, LoaiNguoiGui, NguoiGuiId, NoiDung,
          LoaiDinhKem, DinhKemId, DinhKemJson, DaDoc, NgayTao)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      input.conversationId,
      input.senderType,
      input.senderId,
      input.content,
      input.attachment?.type ?? null,
      input.attachment?.refId ?? null,
      input.attachment ? JSON.stringify(input.attachment) : null,
      input.now,
    );
    const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    return toNumber(ids[0]?.id);
  }

  private async recentHistory(conversationId: number, take: number) {
    const rows = await this.prisma.$queryRawUnsafe<MessageRow[]>(
      `SELECT * FROM (
         SELECT Id AS id, CuocHoiThoaiId AS conversationId,
                LoaiNguoiGui AS senderType, NguoiGuiId AS senderId,
                NoiDung AS content, LoaiDinhKem AS attachmentType,
                DinhKemId AS attachmentRefId, DinhKemJson AS attachmentData,
                DaDoc AS isRead, NgayTao AS createdAt
         FROM TinNhan WHERE CuocHoiThoaiId=?
         ORDER BY Id DESC LIMIT ${Math.max(1, take)}
       ) h ORDER BY id ASC`,
      conversationId,
    );
    return rows;
  }

  private lockConversation(tx: SqlClient, id: number) {
    return this.getConversationWithClient(tx, id, true);
  }

  private async getConversationWithClient(
    client: SqlClient,
    id: number,
    forUpdate = false,
  ) {
    const rows = await client.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()}
       WHERE Id=? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
      id,
    );
    return rows[0] ?? null;
  }

  private async getMessageWithClient(client: SqlClient, id: number) {
    const rows = await client.$queryRawUnsafe<MessageRow[]>(
      `SELECT Id AS id, CuocHoiThoaiId AS conversationId,
              LoaiNguoiGui AS senderType, NguoiGuiId AS senderId,
              NoiDung AS content, LoaiDinhKem AS attachmentType,
              DinhKemId AS attachmentRefId, DinhKemJson AS attachmentData,
              DaDoc AS isRead, NgayTao AS createdAt
       FROM TinNhan WHERE Id=? LIMIT 1`,
      id,
    );
    return rows[0] ?? null;
  }

  private ownedBy(conv: ConversationRow, who: ChatIdentity) {
    if (who.userId !== null && !who.isStaff) {
      return toNumber(conv.userId) === who.userId;
    }
    return (
      who.userId === null &&
      Boolean(who.guestId) &&
      conv.guestId === who.guestId
    );
  }

  private mapConversation(row: ConversationRow) {
    return {
      id: toNumber(row.id),
      status: row.status,
      userId:
        row.userId === null || row.userId === undefined
          ? null
          : toNumber(row.userId),
      guestId: row.guestId,
      displayName: row.displayName,
      assignedStaffId:
        row.assignedStaffId === null || row.assignedStaffId === undefined
          ? null
          : toNumber(row.assignedStaffId),
      productContextId:
        row.productContextId === null || row.productContextId === undefined
          ? null
          : toNumber(row.productContextId),
      lastMessagePreview: row.lastMessagePreview,
      lastMessageAt: row.lastMessageAt,
      unreadForCustomer: toNumber(row.unreadForCustomer),
      unreadForAgent: toNumber(row.unreadForAgent),
      createdAt: row.createdAt,
    };
  }

  private mapMessage(row: MessageRow, quickReplies?: QuickReply[]) {
    let attachment: ChatAttachment | null = null;
    if (row.attachmentData) {
      try {
        attachment = JSON.parse(row.attachmentData) as ChatAttachment;
      } catch {
        attachment = null;
      }
    }
    return {
      id: toNumber(row.id),
      conversationId: toNumber(row.conversationId),
      senderType: row.senderType,
      senderId:
        row.senderId === null || row.senderId === undefined
          ? null
          : toNumber(row.senderId),
      content: row.content,
      attachment,
      isRead: toBoolean(row.isRead),
      createdAt: row.createdAt,
      quickReplies: quickReplies ?? null,
    };
  }

  private conversationSelect() {
    return `SELECT
      Id AS id, NguoiDungId AS userId, MaKhachVangLai AS guestId,
      TenHienThi AS displayName, TrangThai AS status,
      NhanVienId AS assignedStaffId, SanPhamNguCanhId AS productContextId,
      TinNhanCuoi AS lastMessagePreview, ThoiGianTinCuoi AS lastMessageAt,
      SoTinChuaDocKhach AS unreadForCustomer,
      SoTinChuaDocNV AS unreadForAgent, NgayTao AS createdAt
    FROM CuocHoiThoai`;
  }

  private enforceRateLimit(conversationId: number) {
    const limit = Number(process.env.CHAT_RATE_LIMIT_PER_WINDOW ?? 10);
    const seconds = Number(process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS ?? 10);
    const now = Date.now();
    const windowMs =
      (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000;
    const max =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
    const list = (windows.get(conversationId) ?? [])
      .filter((time) => now - time <= windowMs);
    if (list.length >= max) {
      throw new BadRequestException({
        message: "Bạn gửi tin quá nhanh. Vui lòng chờ một chút rồi thử lại.",
      });
    }
    list.push(now);
    windows.set(conversationId, list);
  }

  private preview(text: string) {
    return text.length <= 200 ? text : text.slice(0, 200);
  }
}
