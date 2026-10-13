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

interface RuntimeConfig {
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

interface OrderRow {
  id: unknown;
  orderCode: string;
  userId: unknown;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  note: string | null;
  status: string;
  shippingFee: unknown;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippingStatus: string | null;
  shippingProvider: string | null;
  shippingServiceCode: string | null;
}

interface CarrierState {
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

function apiMessage(value: unknown, fallback: string): string {
  const body = record(value);
  return text(body.message) ?? text(record(body.errors).message) ?? fallback;
}

@Injectable()
export class LalamoveShippingService extends ShippingService {
  private readonly webhookPath =
    process.env.LALAMOVE_WEBHOOK_PATH?.trim() ||
    "/api/shipping/lalamove/webhook";

  constructor(private readonly db: PrismaService) {
    super(db);
  }

  override async quote(req: ShippingQuoteInput) {
    const requested = (req.provider ?? "mock").trim().toLowerCase();
    if (requested === "lalamove") {
      const options = await this.quoteLalamoveLifecycle(req);
      return {
        success: options.length > 0,
        message: options.length
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
      this.quoteLalamoveLifecycle(req),
    ]);
    const options = [
      ...mock.options,
      ...ghn.options,
      ...ghtk.options,
      ...lalamove,
    ].sort((a, b) => a.fee - b.fee);
    return {
      success: options.length > 0,
      message: options.length ? null : "Không tính được phí ship cho địa chỉ này.",
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
    const rows = await this.db.$queryRawUnsafe<OrderRow[]>(
      `${this.lalamoveOrderSelect()}
       WHERE MaDonHang = ? AND NguoiDungId = ? LIMIT 1`,
      orderCode,
      userId,
    );
    const order = rows[0];
    if (order?.shippingProvider?.toLowerCase() === "lalamove") {
      if (order.trackingCode) {
        await this.syncLalamoveOrder(toNumber(order.id), order.trackingCode)
          .catch(() => undefined);
      } else if (order.shippingServiceCode) {
        // Place Order có thể thất bại tạm thời sau khi KaitoKid đã commit đơn.
        // Tracking là một điểm retry idempotent an toàn: nếu MaVanDon đã có thì
        // placeLalamoveOrder trả ngay và không tạo vận đơn thứ hai.
        await this.placeLalamoveOrder(
          toNumber(order.id),
          order.shippingServiceCode,
        ).catch(() => undefined);
      }
    }
    return super.track(userId, orderCode);
  }

  async cancelBeforeCustomerOrder(userId: number, orderId: number) {
    const rows = await this.db.$queryRawUnsafe<OrderRow[]>(
      `${this.lalamoveOrderSelect()}
       WHERE Id = ? AND NguoiDungId = ? LIMIT 1`,
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
        "Lalamove đã nhận/chạy đơn nên KaitoKid không còn cho phép hủy ở trạng thái hiện tại.",
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
        apiMessage(
          payload,
          "Lalamove không cho phép hủy vận đơn ở trạng thái hiện tại.",
        ),
      );
    }
    throw new ServiceUnavailableException(
      apiMessage(payload, "Không thể hủy vận đơn Lalamove lúc này."),
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
    if (!verifyLalamoveWebhookSignature({
      apiKey: body.apiKey,
      expectedApiKey: apiKey,
      apiSecret,
      timestamp: body.timestamp,
      signature: body.signature,
      path: this.webhookPath,
      data: body.data,
    })) {
      throw new UnauthorizedException("Lalamove webhook signature không hợp lệ.");
    }

    const eventId = text(body.eventId)?.slice(0, 120) ?? "";
    const eventType = text(body.eventType)?.slice(0, 80) ?? "UNKNOWN";
    const data = record(body.data);
    const externalOrder = record(data.order);
    const externalOrderId = text(externalOrder.orderId ?? data.orderId);
    if (!externalOrderId) return { received: true, ignored: true };

    const rows = await this.db.$queryRawUnsafe<OrderRow[]>(
      `${this.lalamoveOrderSelect()}
       WHERE LOWER(COALESCE(NhaVanChuyen,'')) = 'lalamove'
         AND MaVanDon = ? LIMIT 1`,
      externalOrderId,
    );
    const order = rows[0];
    if (!order) return { received: true, ignored: true };
    const orderId = toNumber(order.id);
    const marker = eventId ? `[LALAMOVE_EVENT:${eventId}]` : null;

    if (marker) {
      const duplicate = await this.db.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId = ? AND LOCATE(?, COALESCE(MoTa,'')) > 0 LIMIT 1`,
        orderId,
        marker,
      );
      if (duplicate[0]) return { received: true, duplicate: true };
    }

    const eventAt = this.eventTime(data, externalOrder);
    const latest = await this.latestLalamoveEventTime(orderId);
    const stale = Boolean(latest && eventAt && eventAt.getTime() < latest.getTime());
    const state = {
      ...externalOrder,
      shareLink: externalOrder.shareLink ?? data.shareLink,
      status: externalOrder.status ?? data.status,
      driverId: externalOrder.driverId ?? data.driverId,
    };
    if (!stale) await this.applyState(orderId, state);

    const rawStatus = text(state.status) ?? eventType;
    const driverId = text(state.driverId);
    await this.insertHistoryAt(
      orderId,
      this.mapCarrierStatus(rawStatus).shippingStatus,
      [
        marker,
        `Lalamove ${eventType}: ${rawStatus}`,
        driverId ? `driver=${driverId}` : null,
        stale ? "ignored=stale" : null,
      ].filter(Boolean).join(" · "),
      "Lalamove",
      eventAt ?? new Date(),
    );
    return { received: true, stale };
  }

  private async quoteLalamoveLifecycle(
    req: ShippingQuoteInput,
  ): Promise<ShippingQuoteOption[]> {
    if (!req.toProvince?.trim() || !req.toDistrict?.trim()) return [];
    const cfg = await this.loadLalamoveConfig();
    if (!this.configReady(cfg)) return [];
    const dropoff = [req.toAddress, req.toWard, req.toDistrict, req.toProvince]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(", ");
    if (!cfg.pickupAddress || !dropoff) return [];

    try {
      const quotation = await this.createQuotation(cfg, dropoff);
      if (!quotation) return [];
      return [{
        provider: "lalamove",
        // serviceCode phải ổn định để lần re-quote server-authoritative trong
        // OrdersService vẫn đối chiếu được lựa chọn của client. quotationId
        // không được client làm authority; Place Order sẽ lấy quotation mới.
        serviceCode: quotation.serviceType,
        serviceName: quotation.serviceType.toUpperCase() === "MOTORCYCLE"
          ? "Lalamove · Xe máy"
          : `Lalamove · ${quotation.serviceType}`,
        fee: quotation.fee,
        insuranceFee: 0,
        leadTimeHours: 2,
        deliveryType: "on_demand",
      }];
    } catch {
      return [];
    }
  }

  private async createQuotation(cfg: RuntimeConfig, dropoffAddress: string) {
    if (!cfg.pickupAddress) return null;
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
    if (!response.ok) return null;
    const data = record(record(await response.json()).data);
    const quotationId = text(data.quotationId);
    const fee = Number(record(data.priceBreakdown).total ?? 0);
    const serviceType = text(data.serviceType) ?? cfg.serviceType;
    if (!quotationId || !Number.isFinite(fee) || fee <= 0) return null;
    return { quotationId, fee, serviceType, data };
  }

  private async placeLalamoveOrder(
    orderId: number,
    requestedServiceType: string,
  ): Promise<string> {
    const rows = await this.db.$queryRawUnsafe<OrderRow[]>(
      `${this.lalamoveOrderSelect()} WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) throw new Error("Đơn hàng không tồn tại.");
    if (order.shippingProvider?.toLowerCase() === "lalamove" && order.trackingCode) {
      return order.trackingCode;
    }

    const cfg = await this.requireConfig();
    if (!cfg.pickupPhone) {
      throw new Error(
        "Lalamove cần số điện thoại điểm lấy hàng trong Admin Shipping.",
      );
    }
    if (
      requestedServiceType &&
      requestedServiceType.toUpperCase() !== cfg.serviceType.toUpperCase()
    ) {
      throw new Error("Dịch vụ Lalamove đã thay đổi; cần tính lại phí.");
    }

    // Quotation dùng để Place Order luôn được backend tạo mới từ địa chỉ đã
    // persist trong DonHang; không dùng quotationId do client giữ.
    const quotation = await this.createQuotation(cfg, order.customerAddress);
    if (!quotation) throw new Error("Không tạo được quotation Lalamove cho đơn.");

    // Không âm thầm tạo shipment nếu giá carrier đã đổi so với giá backend
    // vừa chốt ở checkout. Cho phép sai số 1 VND do kiểu số/rounding.
    if (Math.abs(quotation.fee - toNumber(order.shippingFee)) > 1) {
      throw new Error(
        "Phí Lalamove đã thay đổi sau checkout; cần tính lại trước khi tạo vận đơn.",
      );
    }

    const detailResponse = await lalamoveRequest(
      this.requestConfig(cfg),
      "GET",
      `/v3/quotations/${encodeURIComponent(quotation.quotationId)}`,
    );
    const detailPayload = await this.safeJson(detailResponse);
    if (!detailResponse.ok) {
      throw new Error(
        apiMessage(
          detailPayload,
          "Quotation Lalamove đã hết hạn hoặc không hợp lệ.",
        ),
      );
    }
    const detail = record(record(detailPayload).data);
    const stops = Array.isArray(detail.stops) ? detail.stops.map(record) : [];
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
          quotationId: quotation.quotationId,
          sender: {
            stopId: pickupStopId,
            name: cfg.pickupName,
            phone: this.normalizePhone(cfg.pickupPhone, cfg.market),
          },
          recipients: [{
            stopId: dropoffStopId,
            name: order.customerName,
            phone: this.normalizePhone(order.customerPhone, cfg.market),
            ...(order.note?.trim()
              ? { remarks: order.note.trim().slice(0, 200) }
              : {}),
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
      throw new Error(apiMessage(payload, "Lalamove Place Order thất bại."));
    }
    const data = record(record(payload).data);
    const externalOrderId = text(data.orderId);
    if (!externalOrderId) throw new Error("Lalamove không trả orderId.");

    await this.applyState(
      orderId,
      data,
      quotation.quotationId,
      externalOrderId,
    );
    await this.appendHistory(
      orderId,
      this.mapCarrierStatus(text(data.status)).shippingStatus,
      `Đã tạo vận đơn Lalamove ${externalOrderId} từ quotation ${quotation.quotationId}`,
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
    const data = record(record(await response.json()).data);
    const previous = await this.db.$queryRawUnsafe<Array<{ status: string | null }>>(
      "SELECT TrangThaiVanChuyen AS status FROM DonHang WHERE Id = ? LIMIT 1",
      orderId,
    );
    await this.applyState(orderId, data);
    const mapped = this.mapCarrierStatus(text(data.status));
    if (mapped.shippingStatus !== (previous[0]?.status ?? null)) {
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
    state: CarrierState,
    quotationId?: string,
    externalOrderId?: string,
  ) {
    const mapped = this.mapCarrierStatus(text(state.status));
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
      externalOrderId ?? text(state.orderId),
      text(state.shareLink),
      quotationId ?? text(state.quotationId),
      mapped.shippingStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      mapped.orderStatus,
      new Date(),
      orderId,
    );
  }

  private mapCarrierStatus(status: string | null) {
    switch ((status ?? "").toUpperCase()) {
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
        return {
          shippingStatus: "ready_to_pick",
          orderStatus: null as string | null,
        };
    }
  }

  private async latestLalamoveEventTime(orderId: number): Promise<Date | null> {
    const rows = await this.db.$queryRawUnsafe<Array<{ time: Date | string | null }>>(
      `SELECT MAX(ThoiGian) AS time FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ? AND LOCATE('[LALAMOVE_EVENT:', COALESCE(MoTa,'')) > 0`,
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

  private eventTime(data: Record<string, any>, order: Record<string, any>) {
    const raw = text(data.updatedAt ?? order.updatedAt);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async loadLalamoveConfig(): Promise<RuntimeConfig> {
    const rows = await this.db.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value FROM CauHinhCuaHang
       WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 1`,
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
    const branch = branches.find((value) =>
      text(valueCaseInsensitive(value, "Address"))
    );
    const branchAddress = branch
      ? [
          text(valueCaseInsensitive(branch, "Address")),
          text(valueCaseInsensitive(branch, "District")),
          text(valueCaseInsensitive(branch, "Province")),
        ].filter(Boolean).join(", ")
      : null;

    return {
      enabled: boolValue(valueCaseInsensitive(raw, "LalamoveEnabled"), false),
      baseUrl: text(valueCaseInsensitive(raw, "LalamoveBaseUrl"))
        ?? process.env.LALAMOVE_BASE_URL?.trim()
        ?? "https://rest.sandbox.lalamove.com",
      market: text(valueCaseInsensitive(raw, "LalamoveMarket"))
        ?? process.env.LALAMOVE_MARKET?.trim()
        ?? "VN",
      apiKey: process.env.LALAMOVE_API_KEY?.trim() || null,
      apiSecret: process.env.LALAMOVE_API_SECRET?.trim() || null,
      serviceType: text(valueCaseInsensitive(raw, "LalamoveServiceType"))
        ?? process.env.LALAMOVE_SERVICE_TYPE?.trim()
        ?? "MOTORCYCLE",
      pickupAddress: text(valueCaseInsensitive(raw, "PickupAddress"))
        ?? process.env.LALAMOVE_PICKUP_ADDRESS?.trim()
        ?? branchAddress,
      pickupName: text(valueCaseInsensitive(raw, "PickupName"))
        ?? text(valueCaseInsensitive(branch ?? {}, "Name"))
        ?? "KaitoKid Shop",
      pickupPhone: text(valueCaseInsensitive(raw, "PickupPhone"))
        ?? text(valueCaseInsensitive(branch ?? {}, "Phone")),
    };
  }

  private configReady(cfg: RuntimeConfig) {
    return Boolean(cfg.enabled && cfg.apiKey && cfg.apiSecret && cfg.pickupAddress);
  }

  private async requireConfig() {
    const cfg = await this.loadLalamoveConfig();
    if (!this.configReady(cfg) || !cfg.apiKey || !cfg.apiSecret) {
      throw new Error("Lalamove chưa được bật/cấu hình đầy đủ ở backend.");
    }
    return cfg;
  }

  private requestConfig(cfg: RuntimeConfig) {
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

  private normalizePhone(value: string, market: string) {
    const source = value.trim();
    if (source.startsWith("+")) {
      return `+${source.slice(1).replace(/\D/g, "")}`;
    }
    const digits = source.replace(/\D/g, "");
    if (market.toUpperCase() === "VN") {
      if (digits.startsWith("84")) return `+${digits}`;
      if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
    }
    return digits;
  }

  private async safeJson(response: Response): Promise<Record<string, unknown>> {
    const body = await response.text();
    if (!body) return {};
    try {
      return record(JSON.parse(body));
    } catch {
      return { message: body.slice(0, 500) };
    }
  }

  private lalamoveOrderSelect() {
    return `SELECT
      Id AS id, MaDonHang AS orderCode, NguoiDungId AS userId,
      TenNguoiNhan AS customerName, SoDienThoai AS customerPhone,
      DiaChiGiao AS customerAddress, GhiChu AS note,
      TrangThai AS status, PhiVanChuyen AS shippingFee,
      MaVanDon AS trackingCode, LinkTracking AS trackingUrl,
      TrangThaiVanChuyen AS shippingStatus,
      NhaVanChuyen AS shippingProvider,
      MaDichVuVanChuyen AS shippingServiceCode
    FROM DonHang`;
  }
}
