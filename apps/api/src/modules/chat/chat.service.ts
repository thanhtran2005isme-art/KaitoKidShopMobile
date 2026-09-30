import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { toBoolean, toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { ChatBotService } from "./chat-bot.service.js";
import type {
  BotReply,
  ChatAttachment,
  ChatIdentity,
  ConversationDto,
  MessageDto,
} from "./chat.types.js";

interface ConversationRow {
  id: unknown;
  userId: unknown;
  guestId: string | null;
  displayName: string | null;
  status: "bot" | "waiting" | "agent" | "closed";
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

@Injectable()
export class ChatService {
  private readonly rate = new Map<number, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: ChatBotService,
  ) {}

  async getOrCreate(
    who: ChatIdentity,
    productContextId: number | null,
  ): Promise<ConversationDto> {
    if (!who.userId && !who.guestId) {
      throw new BadRequestException({
        message: "Thiếu định danh khách (guestId).",
      });
    }

    const existing = who.userId
      ? await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          this.conversationSelect() +
            " WHERE NguoiDungId = ? AND TrangThai <> 'closed' ORDER BY ThoiGianTinCuoi DESC LIMIT 1",
          who.userId,
        )
      : await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          this.conversationSelect() +
            " WHERE MaKhachVangLai = ? AND TrangThai <> 'closed' ORDER BY ThoiGianTinCuoi DESC LIMIT 1",
          who.guestId,
        );

    if (existing[0]) {
      if (
        productContextId !== null &&
        toNumber(existing[0].productContextId) !== productContextId
      ) {
        await this.prisma.$executeRawUnsafe(
          "UPDATE CuocHoiThoai SET SanPhamNguCanhId = ?, NgayCapNhat = ? WHERE Id = ?",
          productContextId,
          new Date(),
          toNumber(existing[0].id),
        );
        existing[0].productContextId = productContextId;
      }
      return this.mapConversation(existing[0]);
    }

    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      "INSERT INTO CuocHoiThoai (NguoiDungId, MaKhachVangLai, TenHienThi, TrangThai, NhanVienId, SanPhamNguCanhId, TinNhanCuoi, ThoiGianTinCuoi, SoTinChuaDocKhach, SoTinChuaDocNV, NgayTao, NgayCapNhat) VALUES (?, ?, ?, 'bot', NULL, ?, NULL, ?, 0, 0, ?, NULL)",
      who.userId,
      who.userId ? null : who.guestId,
      who.displayName,
      productContextId,
      now,
      now,
    );
    const ids = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    const created = await this.getConversation(toNumber(ids[0]?.id));
    if (!created) throw new Error("Không đọc lại được phiên chat vừa tạo.");
    return created;
  }

  async getConversation(id: number): Promise<ConversationDto | null> {
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      this.conversationSelect() + " WHERE Id = ? LIMIT 1",
      id,
    );
    return rows[0] ? this.mapConversation(rows[0]) : null;
  }

  async isOwner(id: number, who: ChatIdentity): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      this.conversationSelect() + " WHERE Id = ? LIMIT 1",
      id,
    );
    return Boolean(rows[0] && this.ownedBy(rows[0], who));
  }

  async addCustomerMessage(
    who: ChatIdentity,
    conversationId: number,
    text: string,
    attachment: ChatAttachment | null,
  ) {
    this.enforceRate(conversationId);

    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        this.conversationSelect() + " WHERE Id = ? LIMIT 1 FOR UPDATE",
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

      const status =
        conversation.status === "closed" ? "bot" : conversation.status;
      const now = new Date();
      const customer = await this.insertMessage(
        tx,
        conversationId,
        "customer",
        who.userId,
        text,
        attachment,
        now,
      );

      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TrangThai = ?, NhanVienId = CASE WHEN ? = 'bot' AND TrangThai = 'closed' THEN NULL ELSE NhanVienId END, TinNhanCuoi = ?, ThoiGianTinCuoi = ?, SoTinChuaDocNV = SoTinChuaDocNV + 1, NgayCapNhat = ? WHERE Id = ?",
        status,
        status,
        this.preview(text),
        now,
        now,
        conversationId,
      );

      return {
        customer,
        status,
        productContextId:
          conversation.productContextId == null
            ? null
            : toNumber(conversation.productContextId),
      };
    });

    let botMessage: MessageDto | null = null;
    let handedOff = false;

    if (created.status === "bot" || created.status === "waiting") {
      const recent = await this.getHistoryForAdmin(conversationId, 10, 0);
      const failCount = this.trailingBotCount(recent);
      const reply = await this.bot.respond({
        conversationId,
        who,
        userText: text,
        productContextId: created.productContextId,
        recent,
        botFailCount: failCount,
      });

      const saved = await this.saveBotReply(
        conversationId,
        created.status,
        reply,
      );
      botMessage = saved.message;
      handedOff = saved.handedOff;
    }

    return {
      customerMessage: created.customer,
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
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        this.conversationSelect() + " WHERE Id = ? LIMIT 1 FOR UPDATE",
        conversationId,
      );
      if (!rows[0]) throw new NotFoundException();

      const now = new Date();
      const message = await this.insertMessage(
        tx,
        conversationId,
        "agent",
        staffId,
        text,
        attachment,
        now,
      );
      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TrangThai = 'agent', NhanVienId = COALESCE(NhanVienId, ?), TinNhanCuoi = ?, ThoiGianTinCuoi = ?, SoTinChuaDocKhach = SoTinChuaDocKhach + 1, NgayCapNhat = ? WHERE Id = ?",
        staffId,
        this.preview(text),
        now,
        now,
        conversationId,
      );
      return message;
    });
  }

  async history(
    who: ChatIdentity,
    id: number,
    take: number,
    beforeId: number,
  ): Promise<MessageDto[]> {
    if (!(await this.isOwner(id, who))) throw new ForbiddenException();
    return this.getHistoryForAdmin(id, take, beforeId);
  }

  async getHistoryForAdmin(
    id: number,
    take = 200,
    beforeId = 0,
  ): Promise<MessageDto[]> {
    const safeTake = Math.max(1, Math.min(200, take || 50));
    const rows = await this.prisma.$queryRawUnsafe<MessageRow[]>(
      this.messageSelect() +
        " WHERE CuocHoiThoaiId = ?" +
        (beforeId > 0 ? " AND Id < ?" : "") +
        " ORDER BY Id DESC LIMIT " +
        safeTake,
      ...(beforeId > 0 ? [id, beforeId] : [id]),
    );
    rows.reverse();
    return rows.map((row) => this.mapMessage(row));
  }

  async requestHandoff(id: number): Promise<MessageDto | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        this.conversationSelect() + " WHERE Id = ? LIMIT 1 FOR UPDATE",
        id,
      );
      const conversation = rows[0];
      if (!conversation) return null;
      if (conversation.status === "agent") return null;

      const text =
        "Yêu cầu của bạn đã được chuyển tới nhân viên hỗ trợ. Vui lòng chờ trong giây lát, nhân viên sẽ phản hồi sớm nhất có thể nhé! 🙋";
      const now = new Date();
      const message = await this.insertMessage(
        tx,
        id,
        "bot",
        null,
        text,
        null,
        now,
      );
      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TrangThai = 'waiting', TinNhanCuoi = ?, ThoiGianTinCuoi = ?, SoTinChuaDocKhach = SoTinChuaDocKhach + 1, NgayCapNhat = ? WHERE Id = ?",
        this.preview(text),
        now,
        now,
        id,
      );
      return message;
    });
  }

  async claimWithMessage(
    staffId: number,
    id: number,
    staffName: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET NhanVienId = ?, TrangThai = 'agent', NgayCapNhat = ? WHERE Id = ? AND (NhanVienId IS NULL OR TrangThai = 'waiting') AND TrangThai <> 'agent'",
        staffId,
        new Date(),
        id,
      );
      if (!affected) {
        return {
          success: false,
          systemMessage: null as MessageDto | null,
          staffId,
        };
      }

      const name = staffName?.trim() || "Nhân viên hỗ trợ";
      const text =
        "Bạn đã được kết nối với " +
        name +
        ". Nhân viên sẽ hỗ trợ bạn ngay bây giờ! 👩‍💼";
      const now = new Date();
      const message = await this.insertMessage(
        tx,
        id,
        "bot",
        null,
        text,
        null,
        now,
      );
      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TinNhanCuoi = ?, ThoiGianTinCuoi = ?, SoTinChuaDocKhach = SoTinChuaDocKhach + 1, NgayCapNhat = ? WHERE Id = ?",
        this.preview(text),
        now,
        now,
        id,
      );

      return { success: true, systemMessage: message, staffId };
    });
  }

  async closeByCustomer(who: ChatIdentity, id: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ConversationRow[]>(
        this.conversationSelect() + " WHERE Id = ? LIMIT 1 FOR UPDATE",
        id,
      );
      const conversation = rows[0];
      if (!conversation) return false;
      if (!this.ownedBy(conversation, who)) throw new ForbiddenException();
      if (conversation.status === "closed") return true;

      const text =
        "Phiên trò chuyện đã kết thúc. Cảm ơn bạn đã liên hệ KaitoKid Shop! 💖";
      const now = new Date();
      await this.insertMessage(tx, id, "bot", null, text, null, now);
      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TrangThai = 'closed', TinNhanCuoi = ?, ThoiGianTinCuoi = ?, NgayCapNhat = ? WHERE Id = ?",
        this.preview(text),
        now,
        now,
        id,
      );
      return true;
    });
  }

  async closeByAgent(id: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      "UPDATE CuocHoiThoai SET TrangThai = 'closed', NgayCapNhat = ? WHERE Id = ?",
      new Date(),
      id,
    );
  }

  async listMine(who: ChatIdentity): Promise<ConversationDto[]> {
    if (!who.userId && !who.guestId) return [];
    const rows = who.userId
      ? await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          this.conversationSelect() +
            " WHERE NguoiDungId = ? ORDER BY ThoiGianTinCuoi DESC LIMIT 50",
          who.userId,
        )
      : await this.prisma.$queryRawUnsafe<ConversationRow[]>(
          this.conversationSelect() +
            " WHERE MaKhachVangLai = ? ORDER BY ThoiGianTinCuoi DESC LIMIT 50",
          who.guestId,
        );
    return rows.map((row) => this.mapConversation(row));
  }

  async listAgent(
    status: string | null,
    page: number,
    pageSize: number,
    assignedStaffId: number | null,
  ) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (status?.trim()) {
      where.push("TrangThai = ?");
      values.push(status.trim());
    }
    if (assignedStaffId) {
      where.push("NhanVienId = ?");
      values.push(assignedStaffId);
    }
    const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";
    const count = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      "SELECT COUNT(*) AS total FROM CuocHoiThoai" + whereSql,
      ...values,
    );
    const safePage = Math.max(1, page);
    const safeSize = Math.max(1, Math.min(100, pageSize));
    const rows = await this.prisma.$queryRawUnsafe<ConversationRow[]>(
      this.conversationSelect() +
        whereSql +
        " ORDER BY ThoiGianTinCuoi DESC LIMIT " +
        safeSize +
        " OFFSET " +
        (safePage - 1) * safeSize,
      ...values,
    );
    const totalCount = toNumber(count[0]?.total);
    return {
      items: rows.map((row) => this.mapConversation(row)),
      totalCount,
      page: safePage,
      pageSize: safeSize,
      totalPages: Math.ceil(totalCount / safeSize),
    };
  }

  async markRead(id: number, actor: "customer" | "agent"): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (actor === "customer") {
        await tx.$executeRawUnsafe(
          "UPDATE TinNhan SET DaDoc = 1 WHERE CuocHoiThoaiId = ? AND LoaiNguoiGui <> 'customer' AND DaDoc = 0",
          id,
        );
        await tx.$executeRawUnsafe(
          "UPDATE CuocHoiThoai SET SoTinChuaDocKhach = 0, NgayCapNhat = ? WHERE Id = ?",
          new Date(),
          id,
        );
      } else {
        await tx.$executeRawUnsafe(
          "UPDATE TinNhan SET DaDoc = 1 WHERE CuocHoiThoaiId = ? AND LoaiNguoiGui = 'customer' AND DaDoc = 0",
          id,
        );
        await tx.$executeRawUnsafe(
          "UPDATE CuocHoiThoai SET SoTinChuaDocNV = 0, NgayCapNhat = ? WHERE Id = ?",
          new Date(),
          id,
        );
      }
    });
  }

  private async saveBotReply(
    id: number,
    currentStatus: "bot" | "waiting" | "agent" | "closed",
    bot: BotReply,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
        "SELECT TrangThai AS status FROM CuocHoiThoai WHERE Id = ? LIMIT 1 FOR UPDATE",
        id,
      );
      const latestStatus = locked[0]?.status;
      if (latestStatus !== "bot" && latestStatus !== "waiting") {
        return { message: null as MessageDto | null, handedOff: false };
      }

      const now = new Date();
      const message = await this.insertMessage(
        tx,
        id,
        "bot",
        null,
        bot.text,
        bot.attachment,
        now,
        bot.quickReplies,
      );
      const handedOff =
        bot.shouldHandoff &&
        currentStatus === "bot" &&
        latestStatus === "bot";
      await tx.$executeRawUnsafe(
        "UPDATE CuocHoiThoai SET TrangThai = CASE WHEN ? = 1 AND TrangThai = 'bot' THEN 'waiting' ELSE TrangThai END, TinNhanCuoi = ?, ThoiGianTinCuoi = ?, SoTinChuaDocKhach = SoTinChuaDocKhach + 1, NgayCapNhat = ? WHERE Id = ?",
        handedOff ? 1 : 0,
        this.preview(bot.text),
        now,
        now,
        id,
      );
      return { message, handedOff };
    });
  }

  private async insertMessage(
    tx: SqlClient,
    conversationId: number,
    senderType: "customer" | "bot" | "agent",
    senderId: number | null,
    content: string,
    attachment: ChatAttachment | null,
    createdAt: Date,
    quickReplies: Array<{ label: string; payload: string }> = [],
  ): Promise<MessageDto> {
    const payload = attachment
      ? JSON.stringify(attachment)
      : quickReplies.length
        ? JSON.stringify({ quickReplies })
        : null;
    await tx.$executeRawUnsafe(
      "INSERT INTO TinNhan (CuocHoiThoaiId, LoaiNguoiGui, NguoiGuiId, NoiDung, LoaiDinhKem, DinhKemId, DinhKemJson, DaDoc, NgayTao) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
      conversationId,
      senderType,
      senderId,
      content,
      attachment?.type ?? null,
      attachment?.refId ?? null,
      payload,
      createdAt,
    );
    const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    return {
      id: toNumber(ids[0]?.id),
      conversationId,
      senderType,
      senderId,
      content,
      attachment,
      isRead: false,
      createdAt,
      quickReplies: quickReplies.length ? quickReplies : null,
    };
  }

  private mapConversation(row: ConversationRow): ConversationDto {
    return {
      id: toNumber(row.id),
      status: row.status,
      userId: row.userId == null ? null : toNumber(row.userId),
      guestId: row.guestId,
      displayName: row.displayName,
      assignedStaffId:
        row.assignedStaffId == null ? null : toNumber(row.assignedStaffId),
      productContextId:
        row.productContextId == null ? null : toNumber(row.productContextId),
      lastMessagePreview: row.lastMessagePreview,
      lastMessageAt: row.lastMessageAt,
      unreadForCustomer: toNumber(row.unreadForCustomer),
      unreadForAgent: toNumber(row.unreadForAgent),
      createdAt: row.createdAt,
    };
  }

  private mapMessage(row: MessageRow): MessageDto {
    let attachment: ChatAttachment | null = null;
    let quickReplies: Array<{ label: string; payload: string }> | null = null;
    if (row.attachmentData) {
      try {
        const parsed = JSON.parse(row.attachmentData) as Record<string, unknown>;
        if (typeof parsed.type === "string" && typeof parsed.refId === "string") {
          attachment = parsed as unknown as ChatAttachment;
        } else if (Array.isArray(parsed.quickReplies)) {
          quickReplies = parsed.quickReplies as Array<{
            label: string;
            payload: string;
          }>;
        }
      } catch {
        // Legacy payload không hợp lệ được bỏ qua như C#.
      }
    }
    return {
      id: toNumber(row.id),
      conversationId: toNumber(row.conversationId),
      senderType: row.senderType,
      senderId: row.senderId == null ? null : toNumber(row.senderId),
      content: row.content,
      attachment,
      isRead: toBoolean(row.isRead),
      createdAt: row.createdAt,
      quickReplies,
    };
  }

  private ownedBy(row: ConversationRow, who: ChatIdentity): boolean {
    if (who.userId) return toNumber(row.userId) === who.userId;
    return Boolean(who.guestId && row.guestId === who.guestId);
  }

  private preview(text: string): string {
    return text.length <= 200 ? text : text.slice(0, 200);
  }

  private trailingBotCount(history: MessageDto[]): number {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].senderType === "bot") count += 1;
      else if (history[i].senderType === "customer") break;
    }
    return count;
  }

  private enforceRate(id: number): void {
    const limit = Math.max(
      1,
      Number(process.env.CHAT_RATE_LIMIT_PER_WINDOW ?? 10),
    );
    const windowMs =
      Math.max(1, Number(process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS ?? 10)) *
      1000;
    const now = Date.now();
    const list = (this.rate.get(id) ?? []).filter(
      (timestamp) => now - timestamp <= windowMs,
    );
    if (list.length >= limit) {
      throw new BadRequestException({
        message: "Bạn gửi tin quá nhanh. Vui lòng chờ một chút rồi thử lại.",
      });
    }
    list.push(now);
    this.rate.set(id, list);
  }

  private conversationSelect(): string {
    return "SELECT Id AS id, NguoiDungId AS userId, MaKhachVangLai AS guestId, TenHienThi AS displayName, TrangThai AS status, NhanVienId AS assignedStaffId, SanPhamNguCanhId AS productContextId, TinNhanCuoi AS lastMessagePreview, ThoiGianTinCuoi AS lastMessageAt, SoTinChuaDocKhach AS unreadForCustomer, SoTinChuaDocNV AS unreadForAgent, NgayTao AS createdAt FROM CuocHoiThoai";
  }

  private messageSelect(): string {
    return "SELECT Id AS id, CuocHoiThoaiId AS conversationId, LoaiNguoiGui AS senderType, NguoiGuiId AS senderId, NoiDung AS content, DinhKemJson AS attachmentData, DaDoc AS isRead, NgayTao AS createdAt FROM TinNhan";
  }
}
