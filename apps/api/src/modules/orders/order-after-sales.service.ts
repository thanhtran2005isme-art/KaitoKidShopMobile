import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";

const RETURN_WINDOW_DAYS = 15;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const RETURN_MARKERS = [
  "return_requested",
  "return_approved",
  "return_rejected",
  "return_received_restock",
  "return_received_quarantine",
] as const;
const REFUND_MARKERS = [
  "refund_pending",
  "refund_completed_manual",
  "refund_wallet_credited",
] as const;

type CustomerReturnStatus =
  | "none"
  | "requested"
  | "approved"
  | "rejected"
  | "received_restock"
  | "received_quarantine";

type CustomerRefundStatus = "none" | "pending" | "completed";

interface AfterSalesRow {
  id: unknown;
  status: string;
  shippingStatus: string | null;
  completedAt: Date | string | null;
}

interface LockedAfterSalesRow extends AfterSalesRow {
  userId: unknown;
}

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function returnStatus(marker?: string): CustomerReturnStatus {
  switch (marker) {
    case "return_requested": return "requested";
    case "return_approved": return "approved";
    case "return_rejected": return "rejected";
    case "return_received_restock": return "received_restock";
    case "return_received_quarantine": return "received_quarantine";
    default: return "none";
  }
}

function refundStatus(marker?: string): CustomerRefundStatus {
  if (marker === "refund_pending") return "pending";
  if (marker === "refund_completed_manual" || marker === "refund_wallet_credited") {
    return "completed";
  }
  return "none";
}

@Injectable()
export class OrderAfterSalesService {
  constructor(private readonly db: PrismaService) {}

  async decorateMany<T extends { id: number; status: string }>(
    userId: number,
    orders: T[],
  ) {
    if (orders.length === 0) return [] as Array<T & Record<string, unknown>>;

    const ids = orders
      .map((order) => Number(order.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (ids.length === 0) return orders;

    const marks = ids.map(() => "?").join(",");
    const rows = await this.db.$queryRawUnsafe<AfterSalesRow[]>(
      `SELECT Id AS id, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NgayHoanThanh AS completedAt
       FROM DonHang
       WHERE NguoiDungId = ? AND Id IN (${marks})`,
      userId,
      ...ids,
    );
    const markerRows = await this.db.$queryRawUnsafe<Array<{
      id: unknown;
      orderId: unknown;
      status: string;
      at: Date | string;
    }>>(
      `SELECT Id AS id, DonHangId AS orderId, TrangThai AS status, ThoiGian AS at
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId IN (${marks})
         AND TrangThai IN (
           'received_by_customer',
           'return_requested','return_approved','return_rejected',
           'return_received_restock','return_received_quarantine',
           'refund_pending','refund_completed_manual','refund_wallet_credited'
         )
       ORDER BY ThoiGian ASC, Id ASC`,
      ...ids,
    );
    const receiptIds = new Set<number>();
    const latestReturnById = new Map<number, CustomerReturnStatus>();
    const latestRefundById = new Map<number, CustomerRefundStatus>();
    for (const marker of markerRows) {
      const id = toNumber(marker.orderId);
      if (marker.status === "received_by_customer") receiptIds.add(id);
      if ((RETURN_MARKERS as readonly string[]).includes(marker.status)) {
        latestReturnById.set(id, returnStatus(marker.status));
      }
      if ((REFUND_MARKERS as readonly string[]).includes(marker.status)) {
        latestRefundById.set(id, refundStatus(marker.status));
      }
    }

    const byId = new Map(rows.map((row) => [toNumber(row.id), row]));
    return orders.map((order) =>
      this.decorate(
        order,
        byId.get(order.id),
        receiptIds.has(order.id),
        latestReturnById.get(order.id) ?? "none",
        latestRefundById.get(order.id) ?? "none",
      ),
    );
  }

  async decorateOne<T extends { id: number; status: string }>(
    userId: number,
    order: T,
  ) {
    const rows = await this.decorateMany(userId, [order]);
    return rows[0] ?? order;
  }

  async confirmReceived(userId: number, orderId: number) {
    const completedAt = await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, userId, orderId);
      const alreadyConfirmed = await this.hasMarker(
        tx,
        orderId,
        "received_by_customer",
      );
      if (alreadyConfirmed) {
        const existing = asDate(order.completedAt);
        if (existing) return existing;
      }

      const shippingStatus = normalized(order.shippingStatus);
      if (!["delivered", "completed", "delivery_disputed"].includes(shippingStatus)) {
        throw new BadRequestException(
          "Chỉ có thể xác nhận đã nhận hàng sau khi đơn vị vận chuyển báo đã giao.",
        );
      }
      if (["cancelled", "returned"].includes(normalized(order.status))) {
        throw new BadRequestException("Đơn hàng không còn ở trạng thái có thể xác nhận nhận hàng.");
      }

      const now = new Date();
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'completed',
             TrangThaiVanChuyen = 'received_by_customer',
             NgayHoanThanh = ?,
             NgayCapNhat = ?
         WHERE Id = ? AND NguoiDungId = ?`,
        now,
        now,
        orderId,
        userId,
      );
      if (!alreadyConfirmed) {
        await tx.$executeRawUnsafe(
          `INSERT INTO LichSuTrangThaiVanChuyen
             (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
           VALUES (?, 'received_by_customer', ?, 'Khách hàng', ?)`,
          orderId,
          "Khách hàng xác nhận đã nhận hàng",
          now,
        );
      }
      return now;
    });

    return {
      message: "Đã xác nhận nhận hàng.",
      receivedAt: completedAt,
      returnDeadline: new Date(completedAt.getTime() + RETURN_WINDOW_MS),
    };
  }

  async reportNotReceived(userId: number, orderId: number) {
    const changed = await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, userId, orderId);
      if (await this.hasMarker(tx, orderId, "received_by_customer")) {
        throw new BadRequestException(
          "Đơn hàng đã được xác nhận nhận hàng nên không thể báo chưa nhận.",
        );
      }

      const shippingStatus = normalized(order.shippingStatus);
      if (shippingStatus === "delivery_disputed") return false;
      if (!["delivered", "completed"].includes(shippingStatus)) {
        throw new BadRequestException(
          "Chỉ có thể báo chưa nhận khi đơn vị vận chuyển đã đánh dấu giao thành công.",
        );
      }
      if (["cancelled", "returned"].includes(normalized(order.status))) {
        throw new BadRequestException("Đơn hàng không còn ở trạng thái có thể khiếu nại giao hàng.");
      }

      const now = new Date();
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'shipping',
             TrangThaiVanChuyen = 'delivery_disputed',
             NgayHoanThanh = NULL,
             NgayCapNhat = ?
         WHERE Id = ? AND NguoiDungId = ?`,
        now,
        orderId,
        userId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO LichSuTrangThaiVanChuyen
           (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
         VALUES (?, 'delivery_disputed', ?, 'Khách hàng', ?)`,
        orderId,
        "Khách hàng báo chưa nhận được hàng dù đơn vị vận chuyển đã báo giao thành công",
        now,
      );
      return true;
    });

    return {
      message: changed
        ? "Đã ghi nhận báo cáo chưa nhận được hàng. KaitoKid sẽ đối soát với đơn vị vận chuyển."
        : "Yêu cầu chưa nhận được hàng đã được ghi nhận trước đó.",
    };
  }

  async requestReturn(userId: number, orderId: number, rawReason: unknown) {
    const reason = typeof rawReason === "string" ? rawReason.trim() : "";
    if (reason.length < 5) {
      throw new BadRequestException("Vui lòng mô tả lý do hoàn hàng ít nhất 5 ký tự.");
    }
    if (reason.length > 500) {
      throw new BadRequestException("Lý do hoàn hàng tối đa 500 ký tự.");
    }

    const result = await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, userId, orderId);
      if (normalized(order.status) !== "completed") {
        throw new BadRequestException("Chỉ đơn hàng đã nhận mới có thể yêu cầu hoàn hàng.");
      }
      if (!(await this.hasMarker(tx, orderId, "received_by_customer"))) {
        throw new BadRequestException(
          "Khách hàng chưa xác nhận đã nhận hàng nên chưa thể yêu cầu hoàn hàng.",
        );
      }

      const completedAt = asDate(order.completedAt);
      if (!completedAt) {
        throw new BadRequestException(
          "Đơn hàng chưa có mốc xác nhận nhận hàng hợp lệ.",
        );
      }
      const deadline = new Date(completedAt.getTime() + RETURN_WINDOW_MS);
      if (Date.now() > deadline.getTime()) {
        throw new BadRequestException(
          `Đã quá thời hạn hoàn hàng ${RETURN_WINDOW_DAYS} ngày kể từ lúc nhận hàng.`,
        );
      }

      const latest = await this.latestReturnMarker(tx, orderId);
      if (latest === "return_requested" || latest === "return_approved") {
        return { changed: false, deadline };
      }
      if (latest) {
        throw new BadRequestException(
          "Yêu cầu hoàn hàng trước đó đã được xử lý; không thể tạo yêu cầu mới cho cùng đơn.",
        );
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO LichSuTrangThaiVanChuyen
           (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
         VALUES (?, 'return_requested', ?, 'Khách hàng', ?)`,
        orderId,
        `Khách hàng yêu cầu hoàn hàng: ${reason}`,
        new Date(),
      );
      return { changed: true, deadline };
    });

    return {
      message: result.changed
        ? "Đã gửi yêu cầu hoàn hàng. KaitoKid sẽ kiểm tra và phản hồi."
        : "Yêu cầu hoàn hàng đang được KaitoKid xử lý.",
      returnDeadline: result.deadline,
    };
  }

  private decorate<T extends { id: number; status: string }>(
    order: T,
    row: AfterSalesRow | undefined,
    receiptMarker: boolean,
    currentReturnStatus: CustomerReturnStatus,
    currentRefundStatus: CustomerRefundStatus,
  ) {
    if (!row) return order;

    const status = normalized(row.status);
    const shippingStatus = normalized(row.shippingStatus);
    const completedAt = asDate(row.completedAt);
    const receiptConfirmed = receiptMarker && Boolean(completedAt);
    const carrierSaysDelivered = ["delivered", "completed"].includes(shippingStatus);
    const waitingCustomerReceipt =
      !receiptConfirmed &&
      (status === "completed" || carrierSaysDelivered || shippingStatus === "delivery_disputed");
    const effectiveStatus =
      waitingCustomerReceipt && status === "completed" ? "shipping" : status;
    const returnDeadline = receiptConfirmed && completedAt
      ? new Date(completedAt.getTime() + RETURN_WINDOW_MS)
      : null;
    const hasReturnCase = currentReturnStatus !== "none";
    const returnRequested = ["requested", "approved"].includes(currentReturnStatus);
    const canRequestReturn =
      status === "completed" &&
      receiptConfirmed &&
      !hasReturnCase &&
      Boolean(returnDeadline && Date.now() <= returnDeadline.getTime());
    const canReview = status === "completed" && receiptConfirmed;

    return {
      ...order,
      status: effectiveStatus,
      canConfirmReceived:
        !receiptConfirmed &&
        ["delivered", "completed", "delivery_disputed"].includes(shippingStatus) &&
        !["cancelled", "returned"].includes(status),
      canReportNotReceived:
        !receiptConfirmed &&
        carrierSaysDelivered &&
        !["cancelled", "returned"].includes(status),
      deliveryIssueReported: shippingStatus === "delivery_disputed",
      customerReceiptConfirmed: receiptConfirmed,
      canReview,
      canRequestReturn,
      returnRequested,
      returnStatus: currentReturnStatus,
      refundStatus: currentRefundStatus,
      receivedAt: receiptConfirmed ? completedAt : null,
      returnDeadline,
      returnWindowDays: RETURN_WINDOW_DAYS,
    };
  }

  private async hasMarker(
    tx: SqlClient,
    orderId: number,
    status: "received_by_customer",
  ): Promise<boolean> {
    const rows = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
      `SELECT Id AS id FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ? AND TrangThai = ?
       LIMIT 1`,
      orderId,
      status,
    );
    return rows.length > 0;
  }

  private async latestReturnMarker(
    tx: SqlClient,
    orderId: number,
  ): Promise<string | null> {
    const rows = await tx.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT TrangThai AS status
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ?
         AND TrangThai IN (
           'return_requested','return_approved','return_rejected',
           'return_received_restock','return_received_quarantine'
         )
       ORDER BY ThoiGian DESC, Id DESC
       LIMIT 1`,
      orderId,
    );
    return rows[0]?.status ?? null;
  }

  private async lockOrder(
    tx: SqlClient,
    userId: number,
    orderId: number,
  ): Promise<LockedAfterSalesRow> {
    const rows = await tx.$queryRawUnsafe<LockedAfterSalesRow[]>(
      `SELECT Id AS id, NguoiDungId AS userId, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NgayHoanThanh AS completedAt
       FROM DonHang
       WHERE Id = ? AND NguoiDungId = ?
       LIMIT 1 FOR UPDATE`,
      orderId,
      userId,
    );
    if (!rows[0]) {
      throw new BadRequestException("Đơn hàng không tồn tại hoặc không thuộc tài khoản này.");
    }
    return rows[0];
  }
}
