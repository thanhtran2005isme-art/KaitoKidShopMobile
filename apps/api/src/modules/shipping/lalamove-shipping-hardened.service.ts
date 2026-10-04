import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { LalamoveShippingService } from "./lalamove-shipping.service.js";
import { ShippingService } from "./shipping.service.js";

interface ShipmentGuardRow {
  trackingCode: string | null;
  shippingStatus: string | null;
  shippingProvider: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Safety wrapper around the real Lalamove lifecycle.
 *
 * It deliberately does not retry an ambiguous Place Order. Lalamove's
 * Request-ID is useful for tracing but is not treated here as a carrier
 * idempotency guarantee. If the POST outcome is unknown, the order is marked
 * for reconciliation instead of risking a second carrier order.
 *
 * Webhook serialization is per carrier order inside the current Node process.
 * The app currently runs a single Node API process. If the runtime is ever
 * horizontally scaled, replace this process lock with a DB-backed unique
 * webhook event key / distributed lock before enabling multiple writers.
 */
@Injectable()
export class HardenedLalamoveShippingService extends LalamoveShippingService {
  private readonly webhookQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly hardenedDb: PrismaService) {
    super(hardenedDb);
  }

  override async createShippingOrder(
    orderId: number,
    provider: string,
    serviceCode: string,
  ): Promise<string> {
    if (provider.trim().toLowerCase() !== "lalamove") {
      return super.createShippingOrder(orderId, provider, serviceCode);
    }

    const claimed = await this.hardenedDb.$executeRawUnsafe(
      `UPDATE DonHang
       SET TrangThaiVanChuyen = 'lalamove_placing', NgayCapNhat = ?
       WHERE Id = ?
         AND LOWER(COALESCE(NhaVanChuyen,'')) = 'lalamove'
         AND MaVanDon IS NULL
         AND (
           TrangThaiVanChuyen IS NULL
           OR TrangThaiVanChuyen IN ('pending','ready_to_pick','lalamove_place_failed')
         )`,
      new Date(),
      orderId,
    );

    if (claimed === 0) {
      const rows = await this.hardenedDb.$queryRawUnsafe<ShipmentGuardRow[]>(
        `SELECT MaVanDon AS trackingCode,
                TrangThaiVanChuyen AS shippingStatus,
                NhaVanChuyen AS shippingProvider
         FROM DonHang
         WHERE Id = ?
         LIMIT 1`,
        orderId,
      );
      const current = rows[0];
      if (current?.trackingCode) return current.trackingCode;

      if (
        current?.shippingProvider?.toLowerCase() === "lalamove" &&
        ["lalamove_placing", "lalamove_place_unknown"].includes(
          current.shippingStatus ?? "",
        )
      ) {
        throw new ServiceUnavailableException(
          "Vận đơn Lalamove đang xử lý hoặc chưa xác định kết quả. Hệ thống không tự tạo lại để tránh trùng vận đơn.",
        );
      }

      throw new ServiceUnavailableException(
        "Không thể giành quyền tạo vận đơn Lalamove ở trạng thái hiện tại.",
      );
    }

    try {
      return await super.createShippingOrder(orderId, provider, serviceCode);
    } catch (error) {
      // Fail closed. At this layer we cannot prove whether POST /v3/orders was
      // accepted before a timeout/connection loss. Keep an explicit unknown
      // state and require reconciliation instead of issuing another POST.
      await this.hardenedDb.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThaiVanChuyen = 'lalamove_place_unknown', NgayCapNhat = ?
         WHERE Id = ?
           AND MaVanDon IS NULL
           AND TrangThaiVanChuyen = 'lalamove_placing'`,
        new Date(),
        orderId,
      ).catch(() => undefined);

      await this.appendHistory(
        orderId,
        "lalamove_place_unknown",
        "Không xác định được kết quả Place Order Lalamove; khóa auto-retry để tránh tạo trùng vận đơn",
        "Lalamove",
      ).catch(() => undefined);

      throw error;
    }
  }

  override async track(userId: number, orderCode: string) {
    const rows = await this.hardenedDb.$queryRawUnsafe<ShipmentGuardRow[]>(
      `SELECT MaVanDon AS trackingCode,
              TrangThaiVanChuyen AS shippingStatus,
              NhaVanChuyen AS shippingProvider
       FROM DonHang
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    const current = rows[0];

    if (
      current?.shippingProvider?.toLowerCase() === "lalamove" &&
      !current.trackingCode
    ) {
      // Bypass LalamoveShippingService.track(), which historically retried
      // Place Order when MaVanDon was empty. An empty tracking code after an
      // ambiguous request must never trigger a second POST /v3/orders.
      return ShippingService.prototype.track.call(this, userId, orderCode);
    }

    return super.track(userId, orderCode);
  }

  override async handleWebhook(body: Record<string, unknown>) {
    const data = record(body.data);
    const order = record(data.order);
    const externalOrderId = text(order.orderId ?? data.orderId);
    if (!externalOrderId) return super.handleWebhook(body);

    return this.withWebhookQueue(
      externalOrderId,
      () => super.handleWebhook(body),
    );
  }

  private async withWebhookQueue<T>(
    key: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.webhookQueues.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(task);
    this.webhookQueues.set(key, run);

    try {
      return await run;
    } finally {
      if (this.webhookQueues.get(key) === run) {
        this.webhookQueues.delete(key);
      }
    }
  }
}
