import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
      orderId: unknown;
      status: string;
    }>>(
      `SELECT DonHangId AS orderId, TrangThai AS status
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId IN (${marks})
         AND TrangThai IN ('received_by_customer','return_requested')`,
      ...ids,
    );
    const receiptIds = new Set<number>();
    const returnIds = new Set<number>();
    for (const marker of markerRows) {
      const id = toNumber(marker.orderId);
      if (marker.status === "received_by_customer") receiptIds.add(id);
      if (marker.status === "return_requested") returnIds.add(id);
    }

    const byId = new Map(rows.map((row) => [toNumber(row.id), row]));
    return orders.map((order) =>
      this.decorate(
        order,
        byId.get(order.id),
        receiptIds.has(order.id),
        returnIds.has(order.id),
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
        throw new BadRequestException("Đã quá thời hạn hoàn hàng 7 ngày kể từ lúc nhận hàng.");
      }

      const duplicate = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId = ? AND TrangThai = 'return_requested'
         LIMIT 1`,
        orderId,
      );
      if (duplicate.length > 0) return { changed: false, deadline };

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
        : "Yêu cầu hoàn hàng đã được ghi nhận trước đó.",
      returnDeadline: result.deadline,
    };
  }

  private decorate<T extends { id: number; status: string }>(
    order: T,
    row: AfterSalesRow | undefined,
    receiptMarker: boolean,
    returnRequested: boolean,
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
    const hasOpenReturn = returnRequested && status !== "returned";
    const canRequestReturn =
      status === "completed" &&
      receiptConfirmed &&
      !hasOpenReturn &&
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
      returnRequested: hasOpenReturn,
      receivedAt: receiptConfirmed ? completedAt : null,
      returnDeadline,
      returnWindowDays: 7,
    };
  }

  private async hasMarker(
    tx: SqlClient,
    orderId: number,
    status: "received_by_customer" | "return_requested",
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
