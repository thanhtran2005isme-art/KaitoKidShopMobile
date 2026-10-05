import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { HardenedLalamoveShippingService } from "./lalamove-shipping-hardened.service.js";
import { ShippingService } from "./shipping.service.js";

interface ReceiptBoundaryRow {
  id: unknown;
  status: string;
  shippingStatus: string | null;
  shippingProvider: string | null;
  completedAt: Date | string | null;
}

const LALAMOVE_PROGRESS_RANK: Record<string, number> = {
  ready_to_pick: 1,
  lalamove_on_going: 2,
  delivering: 3,
  delivered: 4,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Giữ ranh giới giữa "carrier báo giao xong" và "khách xác nhận đã nhận".
 *
 * Lalamove COMPLETED chỉ cho phép vận chuyển đi tới `delivered`. Business order
 * vẫn ở `shipping` cho tới khi khách gọi confirm-received. Bằng chứng khách
 * nhận hàng phải có cả `NgayHoanThanh` và history marker
 * `received_by_customer`; timestamp legacy/Admin đơn lẻ không đủ authority.
 * Sau khi khách xác nhận/khiếu nại hoặc Admin hoàn tất return, polling/webhook
 * carrier không được phép ghi đè state hậu mãi.
 *
 * Webhook Lalamove có thể phát nhiều event cùng timestamp (ví dụ
 * ORDER_STATUS_CHANGED=COMPLETED và POD_STATUS_CHANGED=PICKED_UP). Vì vậy ngoài
 * stale-time guard ở lớp dưới, lớp này còn khóa tiến trình carrier theo rank để
 * event đến sau nhưng ở bước thấp hơn không làm trạng thái bị lùi.
 */
@Injectable()
export class ReceiptAwareLalamoveShippingService extends HardenedLalamoveShippingService {
  private readonly receiptQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly receiptDb: PrismaService) {
    super(receiptDb);
  }

  override async track(userId: number, orderCode: string) {
    const before = await this.loadByOwner(userId, orderCode);
    const result = await super.track(userId, orderCode);

    if (before?.shippingProvider?.toLowerCase() === "lalamove") {
      await this.restoreCarrierProgressBoundary(before);
      await this.restoreReceiptBoundary(before);
      return ShippingService.prototype.track.call(this, userId, orderCode);
    }

    return result;
  }

  override async handleWebhook(body: Record<string, unknown>) {
    const data = record(body.data);
    const carrierOrder = record(data.order);
    const externalOrderId = text(carrierOrder.orderId ?? data.orderId);
    if (!externalOrderId) return super.handleWebhook(body);

    return this.withReceiptQueue(externalOrderId, async () => {
      const before = await this.loadByTrackingCode(externalOrderId);
      const result = await super.handleWebhook(body);
      if (before) {
        await this.restoreCarrierProgressBoundary(before);
        await this.restoreReceiptBoundary(before);
      }
      return result;
    });
  }

  private async restoreCarrierProgressBoundary(before: ReceiptBoundaryRow) {
    const orderId = Number(before.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return;

    const rows = await this.receiptDb.$queryRawUnsafe<ReceiptBoundaryRow[]>(
      `SELECT Id AS id, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NhaVanChuyen AS shippingProvider,
              NgayHoanThanh AS completedAt
       FROM DonHang WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const current = rows[0];
    if (!current) return;

    const beforeShipping = normalized(before.shippingStatus);
    const currentShipping = normalized(current.shippingStatus);
    const beforeRank = LALAMOVE_PROGRESS_RANK[beforeShipping];
    const currentRank = LALAMOVE_PROGRESS_RANK[currentShipping];

    const progressRegressed =
      Number.isFinite(beforeRank) &&
      Number.isFinite(currentRank) &&
      currentRank < beforeRank;

    const deliveredRegressedToTerminalFailure =
      beforeShipping === "delivered" &&
      ["carrier_cancelled", "cancelled", "failed"].includes(currentShipping);

    if (!progressRegressed && !deliveredRegressedToTerminalFailure) return;

    await this.receiptDb.$executeRawUnsafe(
      `UPDATE DonHang
       SET TrangThaiVanChuyen = ?, NgayCapNhat = ?
       WHERE Id = ?`,
      before.shippingStatus,
      new Date(),
      orderId,
    );
  }

  private async restoreReceiptBoundary(before: ReceiptBoundaryRow) {
    const orderId = Number(before.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return;

    const rows = await this.receiptDb.$queryRawUnsafe<ReceiptBoundaryRow[]>(
      `SELECT Id AS id, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NhaVanChuyen AS shippingProvider,
              NgayHoanThanh AS completedAt
       FROM DonHang WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const current = rows[0];
    if (!current) return;

    const beforeStatus = normalized(before.status);
    const beforeShipping = normalized(before.shippingStatus);
    const currentStatus = normalized(current.status);
    const currentShipping = normalized(current.shippingStatus);
    const completedAt = current.completedAt ?? before.completedAt;

    if (beforeStatus === "cancelled") {
      await this.receiptDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'cancelled', TrangThaiVanChuyen = 'cancelled', NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
      return;
    }

    if (beforeStatus === "returned" || currentStatus === "returned") {
      await this.receiptDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'returned', TrangThaiVanChuyen = 'returned', NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
      return;
    }

    const receiptConfirmed =
      Boolean(completedAt) && await this.hasCustomerReceiptMarker(orderId);
    if (receiptConfirmed) {
      await this.receiptDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'completed',
             TrangThaiVanChuyen = 'received_by_customer',
             NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
      return;
    }

    const dispute =
      beforeShipping === "delivery_disputed" ||
      currentShipping === "delivery_disputed" ||
      await this.hasOpenDeliveryDispute(orderId);
    if (dispute) {
      await this.receiptDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'shipping',
             TrangThaiVanChuyen = 'delivery_disputed',
             NgayHoanThanh = NULL,
             NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
      return;
    }

    // Carrier has delivered, but the customer has not acknowledged receipt.
    // Clear any legacy/Admin completion timestamp because it has no matching
    // customer receipt marker and therefore cannot start review/return rights.
    if (["delivered", "completed"].includes(currentShipping)) {
      await this.receiptDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'shipping',
             TrangThaiVanChuyen = 'delivered',
             NgayHoanThanh = NULL,
             NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
    }
  }

  private async hasCustomerReceiptMarker(orderId: number): Promise<boolean> {
    const rows = await this.receiptDb.$queryRawUnsafe<Array<{ id: unknown }>>(
      `SELECT Id AS id
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ? AND TrangThai = 'received_by_customer'
       LIMIT 1`,
      orderId,
    );
    return rows.length > 0;
  }

  private async hasOpenDeliveryDispute(orderId: number): Promise<boolean> {
    const rows = await this.receiptDb.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT TrangThai AS status
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ?
         AND TrangThai IN ('delivery_disputed','received_by_customer')
       ORDER BY ThoiGian DESC, Id DESC
       LIMIT 1`,
      orderId,
    );
    return normalized(rows[0]?.status) === "delivery_disputed";
  }

  private async loadByOwner(userId: number, orderCode: string) {
    const rows = await this.receiptDb.$queryRawUnsafe<ReceiptBoundaryRow[]>(
      `SELECT Id AS id, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NhaVanChuyen AS shippingProvider,
              NgayHoanThanh AS completedAt
       FROM DonHang
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    return rows[0] ?? null;
  }

  private async loadByTrackingCode(trackingCode: string) {
    const rows = await this.receiptDb.$queryRawUnsafe<ReceiptBoundaryRow[]>(
      `SELECT Id AS id, TrangThai AS status,
              TrangThaiVanChuyen AS shippingStatus,
              NhaVanChuyen AS shippingProvider,
              NgayHoanThanh AS completedAt
       FROM DonHang
       WHERE LOWER(COALESCE(NhaVanChuyen,'')) = 'lalamove'
         AND MaVanDon = ?
       LIMIT 1`,
      trackingCode,
    );
    return rows[0] ?? null;
  }

  private async withReceiptQueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.receiptQueues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.receiptQueues.set(key, run);
    try {
      return await run;
    } finally {
      if (this.receiptQueues.get(key) === run) this.receiptQueues.delete(key);
    }
  }
}
