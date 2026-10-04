import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { lalamoveRequest } from "./lalamove.client.js";
import { LalamoveShippingService } from "./lalamove-shipping.service.js";
import { valueCaseInsensitive } from "./shipping.helpers.js";
import { ShippingService } from "./shipping.service.js";

interface ShipmentGuardRow {
  trackingCode: string | null;
  shippingStatus: string | null;
  shippingProvider: string | null;
}

interface TrackingStateRow {
  shippingStatus: string | null;
}

interface TrackingCarrierConfig {
  baseUrl: string;
  market: string;
  apiKey: string;
  apiSecret: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function carrierMessage(value: unknown, fallback: string): string {
  const body = record(value);
  const errors = body.errors;
  if (Array.isArray(errors)) {
    for (const item of errors) {
      const message = text(record(item).message);
      if (message) return message;
    }
  }
  return text(body.message) ?? text(record(errors).message) ?? fallback;
}

function mapCarrierStatusStrict(status: string) {
  switch (status.toUpperCase()) {
    case "ASSIGNING_DRIVER":
      return {
        shippingStatus: "ready_to_pick",
        orderStatus: null as string | null,
      };
    case "ON_GOING":
      return { shippingStatus: "lalamove_on_going", orderStatus: "confirmed" };
    case "PICKED_UP":
      return { shippingStatus: "delivering", orderStatus: "shipping" };
    case "COMPLETED":
      return { shippingStatus: "delivered", orderStatus: "completed" };
    case "CANCELED":
      return {
        shippingStatus: "cancelled",
        orderStatus: null as string | null,
      };
    case "REJECTED":
    case "EXPIRED":
      return { shippingStatus: "failed", orderStatus: null as string | null };
    default:
      return null;
  }
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

    if (current?.shippingProvider?.toLowerCase() === "lalamove") {
      if (!current.trackingCode) {
        // Never retry Place Order from tracking when the external id is empty.
        return ShippingService.prototype.track.call(this, userId, orderCode);
      }

      // Known real Lalamove order: always synchronize carrier state before
      // returning tracking data. Do not swallow carrier/auth/HTTP errors and
      // silently return a stale PICKED_UP/delivering state.
      await this.syncKnownLalamoveOrder(
        current.trackingCode,
        orderCode,
        userId,
      );
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

  private async syncKnownLalamoveOrder(
    trackingCode: string,
    orderCode: string,
    userId: number,
  ) {
    const config = await this.loadTrackingCarrierConfig();
    const response = await lalamoveRequest(
      config,
      "GET",
      `/v3/orders/${encodeURIComponent(trackingCode)}`,
    );
    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Không đồng bộ được trạng thái Lalamove (HTTP ${response.status}): ${carrierMessage(
          payload,
          "Lalamove Get Order Details thất bại.",
        )}`,
      );
    }

    const carrier = record(payload.data);
    const rawStatus = text(carrier.status);
    if (!rawStatus) {
      throw new ServiceUnavailableException(
        "Lalamove Get Order Details không trả trường status; từ chối trả trạng thái cũ.",
      );
    }

    const mapped = mapCarrierStatusStrict(rawStatus);
    if (!mapped) {
      throw new ServiceUnavailableException(
        `Lalamove trả trạng thái chưa được hỗ trợ: ${rawStatus}`,
      );
    }

    const orderRows = await this.hardenedDb.$queryRawUnsafe<
      Array<{ id: unknown; shippingStatus: string | null }>
    >(
      `SELECT Id AS id, TrangThaiVanChuyen AS shippingStatus
       FROM DonHang
       WHERE MaDonHang = ? AND NguoiDungId = ?
         AND LOWER(COALESCE(NhaVanChuyen,'')) = 'lalamove'
         AND MaVanDon = ?
       LIMIT 1`,
      orderCode,
      userId,
      trackingCode,
    );
    const order = orderRows[0];
    if (!order) {
      throw new ServiceUnavailableException(
        "Không tìm thấy vận đơn Lalamove tương ứng để đồng bộ.",
      );
    }

    const orderId = Number(order.id);
    if (!Number.isFinite(orderId)) {
      throw new ServiceUnavailableException("ID đơn hàng không hợp lệ khi đồng bộ Lalamove.");
    }

    await this.hardenedDb.$executeRawUnsafe(
      `UPDATE DonHang
       SET LinkTracking = COALESCE(?, LinkTracking),
           TrangThaiVanChuyen = ?,
           TrangThai = CASE
             WHEN ? = 'completed' AND TrangThai <> 'cancelled' THEN 'completed'
             WHEN ? = 'shipping' AND TrangThai <> 'cancelled' THEN 'shipping'
             WHEN ? = 'confirmed' AND TrangThai = 'pending' THEN 'confirmed'
             ELSE TrangThai
           END,
           NgayCapNhat = ?
       WHERE Id = ?`,
      text(carrier.shareLink),
      mapped.shippingStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      new Date(),
      orderId,
    );

    if (mapped.shippingStatus !== (order.shippingStatus ?? null)) {
      await this.appendHistory(
        orderId,
        mapped.shippingStatus,
        `Đồng bộ Lalamove: ${rawStatus.toUpperCase()}`,
        "Lalamove",
      );
    }
  }

  private async loadTrackingCarrierConfig(): Promise<TrackingCarrierConfig> {
    const apiKey = process.env.LALAMOVE_API_KEY?.trim() ?? "";
    const apiSecret = process.env.LALAMOVE_API_SECRET?.trim() ?? "";
    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        "Backend thiếu LALAMOVE_API_KEY/LALAMOVE_API_SECRET để đồng bộ tracking.",
      );
    }

    const rows = await this.hardenedDb.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value FROM CauHinhCuaHang
       WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 1`,
    );
    let raw: Record<string, unknown> = {};
    try {
      raw = rows[0]?.value ? record(JSON.parse(rows[0].value)) : {};
    } catch {
      raw = {};
    }

    return {
      baseUrl:
        text(valueCaseInsensitive(raw, "LalamoveBaseUrl"))
        ?? process.env.LALAMOVE_BASE_URL?.trim()
        ?? "https://rest.sandbox.lalamove.com",
      market:
        text(valueCaseInsensitive(raw, "LalamoveMarket"))
        ?? process.env.LALAMOVE_MARKET?.trim()
        ?? "VN",
      apiKey,
      apiSecret,
    };
  }

  private async readJson(response: Response): Promise<Record<string, unknown>> {
    const body = await response.text();
    if (!body) return {};
    try {
      return record(JSON.parse(body));
    } catch {
      return { message: body.slice(0, 500) };
    }
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
