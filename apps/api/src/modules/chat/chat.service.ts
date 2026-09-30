import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { toBoolean, toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { ChatBotService } from "./chat-bot.service.js";
import {
  type BotContext,
  type ChatActor,
  type ChatAttachment,
  type ChatIdentity,
  type ChatStatus,
  type ConversationDto,
  type MessageDto,
  type QuickReply,
} from "./chat.types.js";

interface ConversationRow {
  id: unknown;
  status: ChatStatus;
  userId: unknown;
  guestId: string | null;
  displayName: string | null;
  assignedStaffId: unknown;
  productContextId: unknown;
  lastMessagePreview: string | null;
  lastMessageAt: Date | string;
  unreadForCustomer: unknown;
  unreadForAgent: unknown;
  createdAt: Date | string;
}

interface MessageRow {
  id: unknown;
  conversationId: unknown;
  senderType: "customer" | "bot" | "agent";
  senderId: unknown;
  content: string;
  attachmentData: string | null;
  isRead: unknown;
  createdAt: Date | string;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class ChatService {
  private readonly rateWindows = new Map<number, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: ChatBotService,
  ) {}

  async getOrCreate(
    who: ChatIdentity,
    productContextId: number | null,
  ): Promise<ConversationDto> {
    let rows: ConversationRow[] = [];
    if (who.authenticated) {
      rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE NguoiDungId = ? AND TrangThai <> 'closed'
         ORDER BY ThoiGianTinCuoi DESC
         LIMIT 1`,
        who.userId,
      );
    } else if (who.guestId) {
      rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE MaKhachVangLai = ? AND TrangThai <> 'closed'
         ORDER BY ThoiGianTinCuoi DESC
         LIMIT 1`,
        who.guestId,
      );
    }

    const existing = rows[0];
    if (existing) {
      if (
        productContextId !== null &&
        nullableNumber(existing.productContextId) !== productContextId
      ) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SanPhamNguCanhId = ?, NgayCapNhat = ?
           WHERE Id = ?`,
          productContextId,
          new Date(),
          toNumber(existing.id),
        );
        existing.productContextId = productContextId;
      }
      return this.mapConversation(existing);
    }

    if (!who.authenticated && !who.guestId) {
      throw new BadRequestException({
        message: "Thiếu định danh khách (guestId).",
      });
    }

    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO CuocHoiThoai
         (NguoiDungId, MaKhachVangLai, TenHienThi, TrangThai,
          NhanVienId, SanPhamNguCanhId, TinNhanCuoi,
          ThoiGianTinCuoi, SoTinChuaDocKhach, SoTinChuaDocNV,
          NgayTao, NgayCapNhat)
       VALUES (?, ?, ?, 'bot', NULL, ?, NULL, ?, 0, 0, ?, NULL)`,
      who.userId,
      who.authenticated ? null : who.guestId,
      who.displayName,
      productContextId,
      now,
      now,
    );
    const ids = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    return (await this.getConversation(toNumber(ids[0]?.id)))!;
  }

  async getConversation(id: number): Promise<ConversationDto | null> {
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()} WHERE Id = ? LIMIT 1`,
      id,
    );
    return rows[0] ? this.mapConversation(rows[0]) : null;
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
    const customerMessage = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE Id = ? LIMIT 1 FOR UPDATE`,
        conversationId,
      );
      const conversation = rows[0];
      if (!conversation) {
        throw new NotFoundException({
          message: "Không tìm thấy phiên hội thoại.",
        });
      }
      if (!this.ownedBy(conversation, who)) {
        throw new ForbiddenException();
      }
      this.enforceRateLimit(conversationId);

      let status = conversation.status;
      if (status === "closed") status = "bot";
      const now = new Date();
      const messageId = await this.insertMessage(tx, {
        conversationId,
        senderType: "customer",
        senderId: who.userId,
        content,
        attachment,
        createdAt: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai = ?,
             NhanVienId = CASE WHEN ? = 'bot' THEN NULL ELSE NhanVienId END,
             TinNhanCuoi = ?, ThoiGianTinCuoi = ?,
             SoTinChuaDocNV = SoTinChuaDocNV + 1,
             NgayCapNhat = ?
         WHERE Id = ?`,
        status,
        status,
        this.preview(content),
        now,
        now,
        conversationId,
      );
      return (await this.getMessageWithClient(tx, messageId))!;
    });

    const current = await this.getConversation(conversationId);
    let botMessage: MessageDto | null = null;
    let handedOff = false;

    if (current && (current.status === "bot" || current.status === "waiting")) {
      const recent = await this.getRecentHistory(conversationId, 10);
      const context: BotContext = {
        conversationId,
        who,
        userText: content,
        productContextId: current.productContextId,
        recentHistory: recent,
        botFailCount: this.trailingBotCount(recent),
      };
      const reply = await this.bot.respond(context);

      botMessage = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRawUnsafe<ConversationRow[]>(
          `${this.conversationSelect()}
           WHERE Id = ? LIMIT 1 FOR UPDATE`,
          conversationId,
        );
        if (!locked[0]) return null;
        if (locked[0].status === "agent") return null;

        const now = new Date();
        const messageId = await this.insertMessage(tx, {
          conversationId,
          senderType: "bot",
          senderId: null,
          content: reply.text,
          attachment: reply.attachment ?? null,
          createdAt: now,
        });
        const nextStatus =
          reply.shouldHandoff && locked[0].status === "bot"
            ? "waiting"
            : locked[0].status;
        handedOff = nextStatus === "waiting" && locked[0].status !== "waiting";

        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET TrangThai = ?, TinNhanCuoi = ?, ThoiGianTinCuoi = ?,
               SoTinChuaDocKhach = SoTinChuaDocKhach + 1,
               NgayCapNhat = ?
           WHERE Id = ?`,
          nextStatus,
          this.preview(reply.text),
          now,
          now,
          conversationId,
        );
        const message = await this.getMessageWithClient(tx, messageId);
        if (message && reply.quickReplies) {
          message.quickReplies = reply.quickReplies;
        }
        return message;
      });
    }

    return {
      customerMessage,
      botMessage,
      handedOff,
    };
  }

  async addAgentMessage(
    staffId: number,
    conversationId: number,
    text: string,
    attachment: ChatAttachment | null,
  ): Promise<MessageDto> {
    const content = text.trim();
    if (!content) {
      throw new BadRequestException({ message: "Nội dung trống." });
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE Id = ? LIMIT 1 FOR UPDATE`,
        conversationId,
      );
      const conversation = rows[0];
      if (!conversation) throw new NotFoundException();
      const assigned = nullableNumber(conversation.assignedStaffId);
      if (assigned !== null && assigned !== staffId) {
        throw new ConflictException({
          message: "Phiên đã được nhân viên khác nhận.",
        });
      }

      const now = new Date();
      const messageId = await this.insertMessage(tx, {
        conversationId,
        senderType: "agent",
        senderId: staffId,
        content,
        attachment,
        createdAt: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai = 'agent',
             NhanVienId = COALESCE(NhanVienId, ?),
             TinNhanCuoi = ?, ThoiGianTinCuoi = ?,
             SoTinChuaDocKhach = SoTinChuaDocKhach + 1,
             NgayCapNhat = ?
         WHERE Id = ?`,
        staffId,
        this.preview(content),
        now,
        now,
        conversationId,
      );
      return (await this.getMessageWithClient(tx, messageId))!;
    });
  }

  async getHistory(
    who: ChatIdentity,
    conversationId: number,
    take = 50,
    beforeId = 0,
  ): Promise<MessageDto[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new NotFoundException({
        message: "Không tìm thấy phiên hội thoại.",
      });
    }
    if (!this.ownedByDto(conversation, who)) throw new ForbiddenException();
    return this.historyQuery(conversationId, take, beforeId);
  }

  getHistoryForAgent(
    conversationId: number,
    take = 200,
    beforeId = 0,
  ) {
    return this.historyQuery(conversationId, take, beforeId);
  }

  async listForCustomer(who: ChatIdentity): Promise<ConversationDto[]> {
    if (!who.authenticated && !who.guestId) return [];
    const clause = who.authenticated
      ? "NguoiDungId = ?"
      : "MaKhachVangLai = ?";
    const value = who.authenticated ? who.userId : who.guestId;
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()}
       WHERE ${clause}
       ORDER BY ThoiGianTinCuoi DESC
       LIMIT 50`,
      value,
    );
    return rows.map((row) => this.mapConversation(row));
  }

  async listForAgent(input: {
    status?: string;
    page?: number;
    pageSize?: number;
    assignedStaffId?: number | null;
  }) {
    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number(input.pageSize ?? 20) || 20),
    );
    const where: string[] = [];
    const params: unknown[] = [];
    if (input.status?.trim()) {
      where.push("TrangThai = ?");
      params.push(input.status.trim());
    }
    if (input.assignedStaffId) {
      where.push("NhanVienId = ?");
      params.push(input.assignedStaffId);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      `SELECT COUNT(*) AS total FROM CuocHoiThoai ${clause}`,
      ...params,
    );
    const totalCount = toNumber(totals[0]?.total);
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()}
       ${clause}
       ORDER BY ThoiGianTinCuoi DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ...params,
    );
    return {
      items: rows.map((row) => this.mapConversation(row)),
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async requestHandoff(
    conversationId: number,
    reason?: string | null,
  ): Promise<MessageDto | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE Id = ? LIMIT 1 FOR UPDATE`,
        conversationId,
      );
      if (!rows[0]) return null;
      if (rows[0].status === "agent") return null;

      const content =
        "Yêu cầu của bạn đã được chuyển tới nhân viên hỗ trợ. Vui lòng chờ trong giây lát, nhân viên sẽ phản hồi sớm nhất có thể nhé! 🙋";
      const now = new Date();
      const messageId = await this.insertMessage(tx, {
        conversationId,
        senderType: "bot",
        senderId: null,
        content,
        attachment: null,
        createdAt: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai = 'waiting', TinNhanCuoi = ?,
             ThoiGianTinCuoi = ?,
             SoTinChuaDocKhach = SoTinChuaDocKhach + 1,
             NgayCapNhat = ?
         WHERE Id = ?`,
        this.preview(content),
        now,
        now,
        conversationId,
      );
      return this.getMessageWithClient(tx, messageId);
    });
  }

  async claim(
    staffId: number,
    conversationId: number,
    staffName?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET NhanVienId = ?, TrangThai = 'agent', NgayCapNhat = ?
         WHERE Id = ?
           AND TrangThai <> 'agent'
           AND (NhanVienId IS NULL OR TrangThai = 'waiting')`,
        staffId,
        new Date(),
        conversationId,
      );
      if (affected === 0) {
        return { success: false, systemMessage: null, staffId };
      }

      const name = staffName?.trim() || "Nhân viên hỗ trợ";
      const content =
        `Bạn đã được kết nối với ${name}. Nhân viên sẽ hỗ trợ bạn ngay bây giờ! 👩‍💼`;
      const now = new Date();
      const messageId = await this.insertMessage(tx, {
        conversationId,
        senderType: "bot",
        senderId: null,
        content,
        attachment: null,
        createdAt: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TinNhanCuoi = ?, ThoiGianTinCuoi = ?,
             SoTinChuaDocKhach = SoTinChuaDocKhach + 1,
             NgayCapNhat = ?
         WHERE Id = ?`,
        this.preview(content),
        now,
        now,
        conversationId,
      );
      return {
        success: true,
        systemMessage: await this.getMessageWithClient(tx, messageId),
        staffId,
      };
    });
  }

  async close(conversationId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE CuocHoiThoai
       SET TrangThai = 'closed', NgayCapNhat = ?
       WHERE Id = ?`,
      new Date(),
      conversationId,
    );
  }

  async closeByCustomer(
    who: ChatIdentity,
    conversationId: number,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        `${this.conversationSelect()}
         WHERE Id = ? LIMIT 1 FOR UPDATE`,
        conversationId,
      );
      const conversation = rows[0];
      if (!conversation) return false;
      if (!this.ownedBy(conversation, who)) throw new ForbiddenException();
      if (conversation.status === "closed") return true;

      const content =
        "Phiên trò chuyện đã kết thúc. Cảm ơn bạn đã liên hệ KaitoKid Shop! 💖";
      const now = new Date();
      await this.insertMessage(tx, {
        conversationId,
        senderType: "bot",
        senderId: null,
        content,
        attachment: null,
        createdAt: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE CuocHoiThoai
         SET TrangThai = 'closed', TinNhanCuoi = ?,
             ThoiGianTinCuoi = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        this.preview(content),
        now,
        now,
        conversationId,
      );
      return true;
    });
  }

  async markRead(
    conversationId: number,
    reader: ChatActor,
  ): Promise<void> {
    const now = new Date();
    if (reader === "customer") {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE TinNhan
           SET DaDoc = 1
           WHERE CuocHoiThoaiId = ?
             AND LoaiNguoiGui <> 'customer'
             AND DaDoc = 0`,
          conversationId,
        );
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SoTinChuaDocKhach = 0, NgayCapNhat = ?
           WHERE Id = ?`,
          now,
          conversationId,
        );
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE TinNhan
           SET DaDoc = 1
           WHERE CuocHoiThoaiId = ?
             AND LoaiNguoiGui = 'customer'
             AND DaDoc = 0`,
          conversationId,
        );
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET SoTinChuaDocNV = 0, NgayCapNhat = ?
           WHERE Id = ?`,
          now,
          conversationId,
        );
      });
    }
  }

  async isOwner(id: number, who: ChatIdentity): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      `${this.conversationSelect()} WHERE Id = ? LIMIT 1`,
      id,
    );
    return Boolean(rows[0] && this.ownedBy(rows[0], who));
  }

  async sweepIdle(): Promise<number> {
    const enabled = /^(1|true|yes)$/i.test(
      process.env.CHAT_SWEEPER_ENABLED ?? "false",
    );
    if (!enabled) return 0;

    const idleMinutes = Math.max(
      1,
      Number(process.env.CHAT_IDLE_MINUTES ?? 30) || 30,
    );
    const threshold = new Date(Date.now() - idleMinutes * 60_000);
    const ids = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      `SELECT Id AS id
       FROM CuocHoiThoai
       WHERE TrangThai IN ('waiting','agent')
         AND ThoiGianTinCuoi < ?
       ORDER BY Id
       LIMIT 200`,
      threshold,
    );
    let count = 0;
    for (const row of ids) {
      const id = toNumber(row.id);
      const changed = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRawUnsafe<ConversationRow[]>(
          `${this.conversationSelect()}
           WHERE Id = ? LIMIT 1 FOR UPDATE`,
          id,
        );
        if (
          !locked[0] ||
          !["waiting", "agent"].includes(locked[0].status) ||
          new Date(locked[0].lastMessageAt) >= threshold
        ) {
          return false;
        }
        const content =
          "Hội thoại được tạm đóng do không có hoạt động. Bạn nhắn tiếp bất cứ lúc nào để mở lại nhé!";
        const now = new Date();
        await this.insertMessage(tx, {
          conversationId: id,
          senderType: "bot",
          senderId: null,
          content,
          attachment: null,
          createdAt: now,
        });
        await tx.$executeRawUnsafe(
          `UPDATE CuocHoiThoai
           SET TrangThai = 'closed', TinNhanCuoi = ?,
               ThoiGianTinCuoi = ?, NgayCapNhat = ?
           WHERE Id = ?`,
          this.preview(content),
          now,
          now,
          id,
        );
        return true;
      });
      if (changed) count += 1;
    }
    return count;
  }

  private async historyQuery(
    conversationId: number,
    take: number,
    beforeId: number,
  ): Promise<MessageDto[]> {
    const safeTake = Math.max(1, Math.min(200, take || 50));
    const params: unknown[] = [conversationId];
    let before = "";
    if (beforeId > 0) {
      before = " AND Id < ?";
      params.push(beforeId);
    }
    const rows = await this.prisma.$queryRawUnsafe<MessageRow[]>(
      `SELECT * FROM (
         ${this.messageSelect()}
         WHERE CuocHoiThoaiId = ?${before}
         ORDER BY Id DESC
         LIMIT ${safeTake}
       ) recent
       ORDER BY id ASC`,
      ...params,
    );
    return rows.map((row) => this.mapMessage(row));
  }

  private async getRecentHistory(id: number, take: number) {
    return this.historyQuery(id, take, 0);
  }

  private trailingBotCount(history: MessageDto[]) {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].senderType === "bot") count += 1;
      else if (history[i].senderType === "customer") break;
    }
    return count;
  }

  private enforceRateLimit(conversationId: number) {
    const limit = Math.max(
      1,
      Number(process.env.CHAT_RATE_LIMIT_PER_WINDOW ?? 10) || 10,
    );
    const seconds = Math.max(
      1,
      Number(process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS ?? 10) || 10,
    );
    const now = Date.now();
    const cutoff = now - seconds * 1000;
    const window = (this.rateWindows.get(conversationId) ?? []).filter(
      (time) => time >= cutoff,
    );
    if (window.length >= limit) {
      throw new BadRequestException({
        message: "Bạn gửi tin quá nhanh. Vui lòng chờ một chút rồi thử lại.",
      });
    }
    window.push(now);
    this.rateWindows.set(conversationId, window);
  }

  private ownedBy(row: ConversationRow, who: ChatIdentity) {
    if (who.authenticated) {
      return nullableNumber(row.userId) === who.userId;
    }
    return Boolean(who.guestId && row.guestId === who.guestId);
  }

  private ownedByDto(row: ConversationDto, who: ChatIdentity) {
    if (who.authenticated) return row.userId === who.userId;
    return Boolean(who.guestId && row.guestId === who.guestId);
  }

  private preview(text: string) {
    return text.length <= 200 ? text : text.slice(0, 200);
  }

  private mapConversation(row: ConversationRow): ConversationDto {
    return {
      id: toNumber(row.id),
      status: row.status,
      userId: nullableNumber(row.userId),
      guestId: row.guestId,
      displayName: row.displayName,
      assignedStaffId: nullableNumber(row.assignedStaffId),
      productContextId: nullableNumber(row.productContextId),
      lastMessagePreview: row.lastMessagePreview,
      lastMessageAt: row.lastMessageAt,
      unreadForCustomer: toNumber(row.unreadForCustomer),
      unreadForAgent: toNumber(row.unreadForAgent),
      createdAt: row.createdAt,
    };
  }

  private mapMessage(
    row: MessageRow,
    quickReplies?: QuickReply[] | null,
  ): MessageDto {
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
      senderId: nullableNumber(row.senderId),
      content: row.content,
      attachment,
      isRead: toBoolean(row.isRead),
      createdAt: row.createdAt,
      quickReplies,
    };
  }

  private async insertMessage(
    client: {
      $executeRawUnsafe(
        query: string,
        ...values: any[]
      ): Promise<number>;
      $queryRawUnsafe<T = unknown>(
        query: string,
        ...values: any[]
      ): Promise<T>;
    },
    input: {
      conversationId: number;
      senderType: "customer" | "bot" | "agent";
      senderId: number | null;
      content: string;
      attachment: ChatAttachment | null;
      createdAt: Date;
    },
  ): Promise<number> {
    await client.$executeRawUnsafe(
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
      input.createdAt,
    );
    const ids = await client.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    return toNumber(ids[0]?.id);
  }

  private async getMessageWithClient(
    client: {
      $queryRawUnsafe<T = unknown>(
        query: string,
        ...values: any[]
      ): Promise<T>;
    },
    id: number,
  ): Promise<MessageDto | null> {
    const rows = await client.$queryRawUnsafe<MessageRow[]>(
      `${this.messageSelect()} WHERE Id = ? LIMIT 1`,
      id,
    );
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  private conversationSelect() {
    return `SELECT
      Id AS id, TrangThai AS status, NguoiDungId AS userId,
      MaKhachVangLai AS guestId, TenHienThi AS displayName,
      NhanVienId AS assignedStaffId, SanPhamNguCanhId AS productContextId,
      TinNhanCuoi AS lastMessagePreview, ThoiGianTinCuoi AS lastMessageAt,
      SoTinChuaDocKhach AS unreadForCustomer,
      SoTinChuaDocNV AS unreadForAgent, NgayTao AS createdAt
    FROM CuocHoiThoai`;
  }

  private messageSelect() {
    return `SELECT
      Id AS id, CuocHoiThoaiId AS conversationId,
      LoaiNguoiGui AS senderType, NguoiGuiId AS senderId,
      NoiDung AS content, DinhKemJson AS attachmentData,
      DaDoc AS isRead, NgayTao AS createdAt
    FROM TinNhan`;
  }
}
