import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  lalamoveRequest,
  verifyLalamoveWebhookSignature,
} from "./lalamove.client.js";
import {
  boolValue,
  valueCaseInsensitive,
  type ShippingQuoteInput,
  type ShippingQuoteOption,
} from "./shipping.helpers.js";
import { ShippingService } from "./shipping.service.js";

interface LalamoveRuntimeConfig {
  enabled: boolean;
  baseUrl: string;
  market: string;
  apiKey: string | null;
  apiSecret: string | null;
  serviceType: string;
  pickupAddress: string | null;
  pickupName: string;
  pickupPhone: string | null;
}

interface LalamoveOrderRow {
  id: unknown;
  orderCode: string;
  userId: unknown;
  customerName: string;
  customerPhone: string;
  note: string | null;
  status: string;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippingStatus: string | null;
  shippingProvider: string | null;
  shippingServiceCode: string | null;
}

interface LalamoveState {
  orderId?: unknown;
  quotationId?: unknown;
  shareLink?: unknown;
  status?: unknown;
  driverId?: unknown;
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonMessage(value: unknown, fallback: string): string {
  const body = record(value);
  return text(body.message)
    ?? text(record(body.errors).message)
    ?? fallback;
}

@Injectable()
export class LalamoveShippingService extends ShippingService {
  private readonly webhookPath = "/api/shipping/lalamove/webhook";

  constructor(private readonly db: PrismaService) {
    super(db);
  }

  override async quote(req: ShippingQuoteInput) {
    const requested = (req.provider ?? "mock").trim().toLowerCase();
    if (requested === "lalamove") {
      const options = await this.quoteLalamove(req);
      return {
        success: options.length > 0,
        message: options.length > 0
          ? null
          : "Không tính được phí Lalamove cho địa chỉ này.",
        options,
      };
    }

    if (requested !== "all") return super.quote(req);

    const [mock, ghn, ghtk, lalamove] = await Promise.all([
      super.quote({ ...req, provider: "mock" }),
      super.quote({ ...req, provider: "ghn" }),
      super.quote({ ...req, provider: "ghtk" }),
      this.quoteLalamove(req),
    ]);
    const options = [
      ...mock.options,
      ...ghn.options,
      ...ghtk.options,
      ...lalamove,
    ].sort((left, right) => left.fee - right.fee);
    return {
      success: options.length > 0,
      message: options.length > 0
        ? null
        : "Không tính được phí ship cho địa chỉ này.",
      options,
    };
  }

  override async createShippingOrder(
    orderId: number,
    provider: string,
    serviceCode: string,
  ): Promise<string> {
    if (provider.trim().toLowerCase() !== "lalamove") {
      return super.createShippingOrder(orderId, provider, serviceCode);
    }
    return this.placeLalamoveOrder(orderId, serviceCode);
  }

  override async track(userId: number, orderCode: string) {
    const rows = await this.db.$queryRawUnsafe<LalamoveOrderRow[]>(
      `${this.orderSelect()}
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    const order = rows[0];
    if (
      order &&
      order.shippingProvider?.toLowerCase() === "lalamove" &&
      order.trackingCode
    ) {
      await this.syncLalamoveOrder(
        toNumber(order.id),
        order.trackingCode,
      ).catch(() => undefined);
    }
    return super.track(userId, orderCode);
  }

  async cancelBeforeCustomerOrder(userId: number, orderId: number) {
    const rows = await this.db.$queryRawUnsafe<LalamoveOrderRow[]>(
      `${this.orderSelect()}
       WHERE Id = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderId,
      userId,
    );
    const order = rows[0];
    if (!order || order.shippingProvider?.toLowerCase() !== "lalamove") {
      return { external: false };
    }
    if (!order.trackingCode) return { external: false };
    if (
      !["pending", "confirmed"].includes(order.status) ||
      ![null, "ready_to_pick", "picking"].includes(order.shippingStatus)
    ) {
      throw new BadRequestException(
        "Lalamove đã nhận/chạy đơn nên KaitoKid không còn cho phép hủy từ trạng thái hiện tại.",
      );
    }

    const cfg = await this.requireConfig();
    const response = await lalamoveRequest(
      this.requestConfig(cfg),
      "DELETE",
      `/v3/orders/${encodeURIComponent(order.trackingCode)}`,
    );
    if (response.status === 204) {
      await this.appendHistory(
        orderId,
        "carrier_cancelled",
        `Đã hủy vận đơn Lalamove ${order.trackingCode} trước khi hủy đơn KaitoKid`,
        "Lalamove",
      );
      return { external: true };
    }

    const payload = await this.safeJson(response);
    if (response.status === 409) {
      throw new BadRequestException(
        jsonMessage(
          payload,
          "Lalamove không cho phép hủy vận đơn ở trạng thái hiện tại.",
        ),
      );
    }
    throw new ServiceUnavailableException(
      jsonMessage(payload, "Không thể hủy vận đơn Lalamove lúc này."),
    );
  }

  async handleWebhook(body: Record<string, unknown>) {
    const apiKey = process.env.LALAMOVE_API_KEY?.trim() ?? "";
    const apiSecret = process.env.LALAMOVE_API_SECRET?.trim() ?? "";
    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        "Backend chưa cấu hình Lalamove webhook credentials.",
      );
    }

    const valid = verifyLalamoveWebhookSignature({
      apiKey: body.apiKey,
      expectedApiKey: apiKey,
      apiSecret,
      timestamp: body.timestamp,
      signature: body.signature,
      path: this.webhookPath,
      data: body.data,
    });
    if (!valid) {
      throw new UnauthorizedException("Lalamove webhook signature không hợp lệ.");
    }

    const eventId = text(body.eventId)?.slice(0, 120) ?? "";
    const eventType = text(body.eventType)?.slice(0, 80) ?? "UNKNOWN";
    const data = record(body.data);
    const externalOrder = record(data.order);
    const externalOrderId = text(externalOrder.orderId ?? data.orderId);
    if (!externalOrderId) return { received: true, ignored: true };

    const rows = await this.db.$queryRawUnsafe<LalamoveOrderRow[]>(
      `${this.orderSelect()}
       WHERE LOWER(COALESCE(NhaVanChuyen,'')) = 'lalamove'
         AND MaVanDon = ?
       LIMIT 1`,
      externalOrderId,
    );
    const order = rows[0];
    if (!order) return { received: true, ignored: true };
    const orderId = toNumber(order.id);

    const marker = eventId ? `[LALAMOVE_EVENT:${eventId}]` : null;
    if (marker) {
      const duplicate = await this.db.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId = ? AND LOCATE(?, COALESCE(MoTa,'')) > 0
         LIMIT 1`,
        orderId,
        marker,
      );
      if (duplicate[0]) return { received: true, duplicate: true };
    }

    const eventAt = this.eventTime(data, externalOrder);
    const latest = await this.latestLalamoveEventTime(orderId);
    const stale = Boolean(latest && eventAt && eventAt.getTime() < latest.getTime());

    if (!stale) {
      await this.applyState(orderId, {
        ...externalOrder,
        shareLink: externalOrder.shareLink ?? data.shareLink,
        status: externalOrder.status ?? data.status,
        driverId: externalOrder.driverId ?? data.driverId,
      });
    }

    const status = text(externalOrder.status ?? data.status) ?? eventType;
    const driverId = text(externalOrder.driverId ?? data.driverId);
    const description = [
      marker,
      `Lalamove ${eventType}: ${status}`,
      driverId ? `driver=${driverId}` : null,
      stale ? "ignored=stale" : null,
    ].filter(Boolean).join(" · ");
    await this.insertHistoryAt(
      orderId,
      this.mapStatus(status).shippingStatus,
      description,
      "Lalamove",
      eventAt ?? new Date(),
    );
    return { received: true, stale };
  }

  private async quoteLalamove(
    req: ShippingQuoteInput,
  ): Promise<ShippingQuoteOption[]> {
    if (!req.toProvince?.trim() || !req.toDistrict?.trim()) return [];
    const cfg = await this.loadConfig();
    if (!this.configReady(cfg)) return [];
    const dropoffAddress = [
      req.toAddress,
      req.toWard,
      req.toDistrict,
      req.toProvince,
    ].filter((value): value is string => Boolean(value?.trim())).join(", ");
    if (!cfg.pickupAddress || !dropoffAddress) return [];

    try {
      const response = await lalamoveRequest(
        this.requestConfig(cfg),
        "POST",
        "/v3/quotations",
        {
          data: {
            serviceType: cfg.serviceType,
            language: "vi_VN",
            stops: [
              { address: cfg.pickupAddress },
              { address: dropoffAddress },
            ],
          },
        },
      );
      if (!response.ok) return [];
      const payload = record(await response.json());
      const data = record(payload.data);
      const quotationId = text(data.quotationId);
      const price = Number(record(data.priceBreakdown).total ?? 0);
      const serviceType = text(data.serviceType) ?? cfg.serviceType;
      if (!quotationId || !Number.isFinite(price) || price <= 0) return [];

      return [{
        provider: "lalamove",
        // Với Lalamove, serviceCode chính là quotationId server-authoritative.
        // OrdersService sẽ persist ID này và Place Order dùng lại ngay sau checkout.
        serviceCode: quotationId,
        serviceName: serviceType.toUpperCase() === "MOTORCYCLE"
          ? "Lalamove · Xe máy"
          : `Lalamove · ${serviceType}`,
        fee: price,
        insuranceFee: 0,
        leadTimeHours: 2,
        deliveryType: "on_demand",
      }];
    } catch {
      return [];
    }
  }

  private async placeLalamoveOrder(
    orderId: number,
    quotationId: string,
  ): Promise<string> {
    const rows = await this.db.$queryRawUnsafe<LalamoveOrderRow[]>(
      `${this.orderSelect()} WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) throw new Error("Đơn hàng không tồn tại.");
    if (
      order.shippingProvider?.toLowerCase() === "lalamove" &&
      order.trackingCode
    ) {
      return order.trackingCode;
    }

    const cfg = await this.requireConfig();
    if (!cfg.pickupPhone) {
      throw new Error(
        "Lalamove cần số điện thoại điểm lấy hàng trong Admin Shipping.",
      );
    }

    const quoteResponse = await lalamoveRequest(
      this.requestConfig(cfg),
      "GET",
      `/v3/quotations/${encodeURIComponent(quotationId)}`,
    );
    const quotePayload = await this.safeJson(quoteResponse);
    if (!quoteResponse.ok) {
      throw new Error(
        jsonMessage(quotePayload, "Quotation Lalamove đã hết hạn hoặc không hợp lệ."),
      );
    }
    const quotation = record(record(quotePayload).data);
    const stops = Array.isArray(quotation.stops) ? quotation.stops.map(record) : [];
    const pickupStopId = text(stops[0]?.stopId);
    const dropoffStopId = text(stops[stops.length - 1]?.stopId);
    if (!pickupStopId || !dropoffStopId || stops.length < 2) {
      throw new Error("Quotation Lalamove không có đủ stopId để tạo vận đơn.");
    }

    const response = await lalamoveRequest(
      this.requestConfig(cfg),
      "POST",
      "/v3/orders",
      {
        data: {
          quotationId,
          sender: {
            stopId: pickupStopId,
            name: cfg.pickupName,
            phone: this.normalizePhone(cfg.pickupPhone, cfg.market),
          },
          recipients: [{
            stopId: dropoffStopId,
            name: order.customerName,
            phone: this.normalizePhone(order.customerPhone, cfg.market),
            ...(order.note?.trim() ? { remarks: order.note.trim().slice(0, 200) } : {}),
          }],
          isPODEnabled: true,
          metadata: {
            kaitoKidOrderId: String(orderId),
            kaitoKidOrderCode: order.orderCode,
          },
        },
      },
    );
    const payload = await this.safeJson(response);
    if (!response.ok) {
      throw new Error(jsonMessage(payload, "Lalamove Place Order thất bại."));
    }

    const data = record(record(payload).data);
    const externalOrderId = text(data.orderId);
    if (!externalOrderId) throw new Error("Lalamove không trả orderId.");

    await this.applyState(orderId, data, quotationId, externalOrderId);
    const mapped = this.mapStatus(text(data.status));
    await this.appendHistory(
      orderId,
      mapped.shippingStatus,
      `Đã tạo vận đơn Lalamove ${externalOrderId} từ quotation ${quotationId}`,
      "Lalamove",
    );
    return externalOrderId;
  }

  private async syncLalamoveOrder(orderId: number, externalOrderId: string) {
    const cfg = await this.requireConfig();
    const response = await lalamoveRequest(
      this.requestConfig(cfg),
      "GET",
      `/v3/orders/${encodeURIComponent(externalOrderId)}`,
    );
    if (!response.ok) return;
    const payload = record(await response.json());
    const data = record(payload.data);

    const rows = await this.db.$queryRawUnsafe<Array<{ shippingStatus: string | null }>>(
      `SELECT TrangThaiVanChuyen AS shippingStatus
       FROM DonHang WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const previous = rows[0]?.shippingStatus ?? null;
    await this.applyState(orderId, data);
    const mapped = this.mapStatus(text(data.status));
    if (mapped.shippingStatus !== previous) {
      await this.appendHistory(
        orderId,
        mapped.shippingStatus,
        `Đồng bộ Lalamove: ${text(data.status) ?? "UNKNOWN"}`,
        "Lalamove",
      );
    }
  }

  private async applyState(
    orderId: number,
    state: LalamoveState,
    quotationId?: string,
    externalOrderId?: string,
  ) {
    const mapped = this.mapStatus(text(state.status));
    const shareLink = text(state.shareLink);
    const trackingCode = externalOrderId ?? text(state.orderId);
    const serviceCode = quotationId ?? text(state.quotationId);

    await this.db.$executeRawUnsafe(
      `UPDATE DonHang
       SET MaVanDon = COALESCE(?, MaVanDon),
           LinkTracking = COALESCE(?, LinkTracking),
           NhaVanChuyen = 'lalamove',
           MaDichVuVanChuyen = COALESCE(?, MaDichVuVanChuyen),
           TrangThaiVanChuyen = ?,
           TrangThai = CASE
             WHEN ? = 'completed' THEN 'completed'
             WHEN ? = 'shipping' AND TrangThai <> 'cancelled' THEN 'shipping'
             WHEN ? = 'confirmed' AND TrangThai = 'pending' THEN 'confirmed'
             ELSE TrangThai
           END,
           NgayCapNhat = ?
       WHERE Id = ?`,
      trackingCode,
      shareLink,
      serviceCode,
      mapped.shippingStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      new Date(),
      orderId,
    );
  }

  private mapStatus(status: string | null): {
    shippingStatus: string;
    orderStatus: string | null;
  } {
    switch ((status ?? "").toUpperCase()) {
      case "ASSIGNING_DRIVER":
        return { shippingStatus: "ready_to_pick", orderStatus: null };
      case "ON_GOING":
        // Dùng trạng thái riêng để CanCancel hiện hữu trở thành false sau khi
        // đã gán tài xế; Lalamove chỉ cho hủy ON_GOING trong cửa sổ rất ngắn.
        return { shippingStatus: "lalamove_on_going", orderStatus: "confirmed" };
      case "PICKED_UP":
        return { shippingStatus: "delivering", orderStatus: "shipping" };
      case "COMPLETED":
        return { shippingStatus: "delivered", orderStatus: "completed" };
      case "CANCELED":
        return { shippingStatus: "cancelled", orderStatus: null };
      case "REJECTED":
      case "EXPIRED":
        return { shippingStatus: "failed", orderStatus: null };
      default:
        return { shippingStatus: "ready_to_pick", orderStatus: null };
    }
  }

  private async latestLalamoveEventTime(orderId: number): Promise<Date | null> {
    const rows = await this.db.$queryRawUnsafe<Array<{ time: Date | string | null }>>(
      `SELECT MAX(ThoiGian) AS time
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ?
         AND LOCATE('[LALAMOVE_EVENT:', COALESCE(MoTa,'')) > 0`,
      orderId,
    );
    return rows[0]?.time ? new Date(rows[0].time) : null;
  }

  private async insertHistoryAt(
    orderId: number,
    status: string,
    description: string,
    location: string | null,
    time: Date,
  ) {
    await this.db.$executeRawUnsafe(
      `INSERT INTO LichSuTrangThaiVanChuyen
         (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
       VALUES (?, ?, ?, ?, ?)`,
      orderId,
      status,
      description,
      location,
      time,
    );
  }

  private eventTime(
    data: Record<string, any>,
    order: Record<string, any>,
  ): Date | null {
    const raw = text(data.updatedAt ?? order.updatedAt);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async loadConfig(): Promise<LalamoveRuntimeConfig> {
    const rows = await this.db.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value
       FROM CauHinhCuaHang
       WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'
       LIMIT 1`,
    );
    let raw: Record<string, unknown> = {};
    try {
      raw = rows[0]?.value ? record(JSON.parse(rows[0].value)) : {};
    } catch {
      raw = {};
    }

    const rawBranches = valueCaseInsensitive(raw, "KaitoKidBranches");
    const branches = Array.isArray(rawBranches)
      ? rawBranches.map(record).filter((branch) =>
          boolValue(valueCaseInsensitive(branch, "Active"), true)
        )
      : [];
    const fallbackBranch = branches.find((branch) =>
      text(valueCaseInsensitive(branch, "Address"))
    );
    const branchAddress = fallbackBranch
      ? [
          text(valueCaseInsensitive(fallbackBranch, "Address")),
          text(valueCaseInsensitive(fallbackBranch, "District")),
          text(valueCaseInsensitive(fallbackBranch, "Province")),
        ].filter(Boolean).join(", ")
      : null;

    return {
      enabled: boolValue(valueCaseInsensitive(raw, "LalamoveEnabled"), false),
      baseUrl:
        text(valueCaseInsensitive(raw, "LalamoveBaseUrl"))
        ?? process.env.LALAMOVE_BASE_URL?.trim()
        ?? "https://rest.sandbox.lalamove.com",
      market:
        text(valueCaseInsensitive(raw, "LalamoveMarket"))
        ?? process.env.LALAMOVE_MARKET?.trim()
        ?? "VN",
      apiKey: process.env.LALAMOVE_API_KEY?.trim() || null,
      apiSecret: process.env.LALAMOVE_API_SECRET?.trim() || null,
      serviceType:
        text(valueCaseInsensitive(raw, "LalamoveServiceType"))
        ?? process.env.LALAMOVE_SERVICE_TYPE?.trim()
        ?? "MOTORCYCLE",
      pickupAddress:
        text(valueCaseInsensitive(raw, "PickupAddress"))
        ?? process.env.LALAMOVE_PICKUP_ADDRESS?.trim()
        ?? branchAddress,
      pickupName:
        text(valueCaseInsensitive(raw, "PickupName"))
        ?? text(valueCaseInsensitive(fallbackBranch ?? {}, "Name"))
        ?? "KaitoKid Shop",
      pickupPhone:
        text(valueCaseInsensitive(raw, "PickupPhone"))
        ?? text(valueCaseInsensitive(fallbackBranch ?? {}, "Phone")),
    };
  }

  private configReady(cfg: LalamoveRuntimeConfig): boolean {
    return Boolean(
      cfg.enabled &&
      cfg.apiKey &&
      cfg.apiSecret &&
      cfg.pickupAddress,
    );
  }

  private async requireConfig(): Promise<LalamoveRuntimeConfig> {
    const cfg = await this.loadConfig();
    if (!this.configReady(cfg) || !cfg.apiKey || !cfg.apiSecret) {
      throw new Error("Lalamove chưa được bật/cấu hình đầy đủ ở backend.");
    }
    return cfg;
  }

  private requestConfig(cfg: LalamoveRuntimeConfig) {
    if (!cfg.apiKey || !cfg.apiSecret) {
      throw new Error("Thiếu Lalamove API credentials.");
    }
    return {
      baseUrl: cfg.baseUrl,
      market: cfg.market,
      apiKey: cfg.apiKey,
      apiSecret: cfg.apiSecret,
    };
  }

  private normalizePhone(value: string, market: string): string {
    const source = value.trim();
    if (source.startsWith("+")) return `+${source.slice(1).replace(/\D/g, "")}`;
    const digits = source.replace(/\D/g, "");
    if (market.toUpperCase() === "VN") {
      if (digits.startsWith("84")) return `+${digits}`;
      if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
    }
    return digits;
  }

  private async safeJson(response: Response): Promise<Record<string, unknown>> {
    const textBody = await response.text();
    if (!textBody) return {};
    try {
      return record(JSON.parse(textBody));
    } catch {
      return { message: textBody.slice(0, 500) };
    }
  }

  private orderSelect(): string {
    return `SELECT
      Id AS id, MaDonHang AS orderCode, NguoiDungId AS userId,
      TenNguoiNhan AS customerName, SoDienThoai AS customerPhone,
      GhiChu AS note, TrangThai AS status, MaVanDon AS trackingCode,
      LinkTracking AS trackingUrl, TrangThaiVanChuyen AS shippingStatus,
      NhaVanChuyen AS shippingProvider,
      MaDichVuVanChuyen AS shippingServiceCode
    FROM DonHang`;
  }
}
