import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { lalamoveRequest, type LalamoveRequestConfig } from "../shipping/lalamove.client.js";

type ShipmentStatus = "placing" | "unknown" | "failed" | "placed" | "in_transit" | "delivered";
type ShipmentRow = {
  id: unknown; orderId: unknown; provider: string; externalId: string | null;
  quotationId: string | null; status: ShipmentStatus; senderName: string;
  senderPhone: string; pickupAddress: string; receiverName: string;
  receiverPhone: string; dropoffAddress: string; fee: unknown;
  trackingUrl: string | null; deliveredAt: Date | string | null;
  errorMessage: string | null; lastCheckedAt: Date | string | null;
};
type OrderRow = {
  id: unknown; orderCode: string; orderStatus: string;
  senderName: string; senderPhone: string; pickupAddress: string;
};
type Config = {
  enabled: boolean; request: LalamoveRequestConfig; serviceType: string;
  shopName: string; shopPhone: string; shopAddress: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function valueOf(source: Record<string, unknown>, key: string): unknown {
  return Object.entries(source).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
}
function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function normalizePhone(value: string, market: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (market.toUpperCase() === "VN") {
    if (digits.startsWith("84")) return "+" + digits;
    if (digits.startsWith("0")) return "+84" + digits.slice(1);
  }
  return digits;
}
function carrierStatus(raw: unknown): ShipmentStatus {
  const status = asText(raw).toUpperCase();
  if (status === "COMPLETED") return "delivered";
  if (status === "PICKED_UP" || status === "ON_GOING") return "in_transit";
  if (status === "ASSIGNING_DRIVER") return "placed";
  if (status === "CANCELED" || status === "REJECTED" || status === "EXPIRED") return "failed";
  throw new ServiceUnavailableException("Lalamove trả trạng thái vận đơn hoàn chưa hỗ trợ.");
}

@Injectable()
export class ReturnShipmentService {
  constructor(private readonly db: PrismaService) {}

  async providers() {
    const cfg = await this.config();
    return [
      {
        code: "lalamove",
        name: "Lalamove",
        enabled: cfg.enabled && Boolean(cfg.request.apiKey && cfg.request.apiSecret && cfg.shopPhone && cfg.shopAddress),
        note: "Tạo vận đơn hoàn thật, theo dõi bằng API Lalamove",
      },
      { code: "ghn", name: "GHN", enabled: false, note: "Chưa tích hợp tạo và xác nhận giao hàng hoàn" },
      { code: "ghtk", name: "GHTK", enabled: false, note: "Chưa tích hợp tạo và xác nhận giao hàng hoàn" },
    ];
  }

  async get(orderId: number) {
    const rows = await this.db.$queryRawUnsafe<ShipmentRow[]>(
      `SELECT Id AS id, DonHangId AS orderId, NhaVanChuyen AS provider,
              MaVanDon AS externalId, MaBaoGia AS quotationId, TrangThai AS status,
              TenNguoiGui AS senderName, SDTNguoiGui AS senderPhone,
              DiaChiLay AS pickupAddress, TenNguoiNhan AS receiverName,
              SDTNguoiNhan AS receiverPhone, DiaChiGiao AS dropoffAddress,
              PhiVanChuyen AS fee, LinkTheoDoi AS trackingUrl,
              GiaoThanhCongLuc AS deliveredAt, LoiCuoi AS errorMessage,
              NgayCapNhat AS lastCheckedAt
       FROM VanDonHoanHang WHERE DonHangId = ? LIMIT 1`,
      orderId,
    );
    const row = rows[0];
    return row ? {
      ...row, id: Number(row.id), orderId: Number(row.orderId),
      fee: row.fee === null ? null : Number(row.fee),
    } : null;
  }

  async dispatch(orderId: number, provider: unknown, actor: string) {
    if (provider !== "lalamove") {
      throw new BadRequestException("Đơn vị này chưa hỗ trợ tạo và xác minh vận đơn hoàn tự động.");
    }
    const cfg = await this.config();
    if (!cfg.enabled || !cfg.shopAddress || !cfg.shopPhone || !cfg.request.apiKey || !cfg.request.apiSecret) {
      throw new BadRequestException("Lalamove chưa được bật hoặc thiếu địa chỉ, số điện thoại shop, API credentials.");
    }

    // Claim is committed BEFORE making any external request. Concurrent requests never place twice.
    const claimed = await this.db.$transaction(async (tx) => {
      const orders = await tx.$queryRawUnsafe<OrderRow[]>(
        `SELECT Id AS id, MaDonHang AS orderCode, TrangThai AS orderStatus,
                TenNguoiNhan AS senderName, SoDienThoai AS senderPhone,
                DiaChiGiao AS pickupAddress
         FROM DonHang WHERE Id = ? LIMIT 1 FOR UPDATE`,
        orderId,
      );
      const order = orders[0];
      if (!order) throw new NotFoundException("Đơn hàng không tồn tại.");
      if (order.orderStatus.toLowerCase() !== "completed") {
        throw new BadRequestException("Chỉ đơn đã hoàn thành mới được tạo vận đơn hoàn.");
      }
      const history = await tx.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT TrangThai AS status FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId = ? AND TrangThai IN
           ('return_requested','return_approved','return_rejected','return_received_restock','return_received_quarantine')
         ORDER BY ThoiGian DESC, Id DESC LIMIT 1`,
        orderId,
      );
      if (history[0]?.status !== "return_approved") {
        throw new BadRequestException("Admin phải duyệt yêu cầu hoàn trước khi đặt vận chuyển.");
      }
      const previous = await tx.$queryRawUnsafe<Array<{ status: ShipmentStatus }>>(
        "SELECT TrangThai AS status FROM VanDonHoanHang WHERE DonHangId = ? LIMIT 1 FOR UPDATE",
        orderId,
      );
      if (previous[0]) {
        throw new BadRequestException(
          "Đã có vận đơn hoàn (hoặc kết quả đặt vận đơn chưa xác định). Không tự tạo thêm; hãy đối soát hãng vận chuyển.",
        );
      }
      if (!order.pickupAddress?.trim() || !order.senderPhone?.trim()) {
        throw new BadRequestException("Đơn thiếu địa chỉ hoặc số điện thoại khách để lấy hàng hoàn.");
      }
      const now = new Date();
      await tx.$executeRawUnsafe(
        `INSERT INTO VanDonHoanHang
          (DonHangId, NhaVanChuyen, TrangThai, TenNguoiGui, SDTNguoiGui,
           DiaChiLay, TenNguoiNhan, SDTNguoiNhan, DiaChiGiao, NgayTao, NgayCapNhat)
         VALUES (?, 'lalamove', 'placing', ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderId, order.senderName, order.senderPhone, order.pickupAddress,
        cfg.shopName, cfg.shopPhone, cfg.shopAddress, now, now,
      );
      return order;
    });

    let placeWasAttempted = false;
    try {
      const quotationResponse = await lalamoveRequest(cfg.request, "POST", "/v3/quotations", {
        data: {
          serviceType: cfg.serviceType,
          language: "vi_VN",
          stops: [{ address: claimed.pickupAddress }, { address: cfg.shopAddress }],
        },
      });
      const quotePayload = await this.json(quotationResponse);
      if (!quotationResponse.ok) {
        throw new BadRequestException("Không tạo được báo giá vận chuyển hoàn từ Lalamove.");
      }
      const quote = asRecord(asRecord(quotePayload).data);
      const quotationId = asText(quote.quotationId);
      const fee = Number(asRecord(quote.priceBreakdown).total);
      if (!quotationId || !Number.isFinite(fee) || fee <= 0) {
        throw new BadRequestException("Báo giá Lalamove thiếu mã hoặc phí hợp lệ.");
      }
      const detailsResponse = await lalamoveRequest(
        cfg.request, "GET", "/v3/quotations/" + encodeURIComponent(quotationId),
      );
      const details = asRecord(asRecord(await this.json(detailsResponse)).data);
      if (!detailsResponse.ok) throw new BadRequestException("Lalamove từ chối báo giá vận chuyển hoàn.");
      const stops = Array.isArray(details.stops) ? details.stops.map(asRecord) : [];
      const fromStopId = asText(stops[0]?.stopId);
      const toStopId = asText(stops[stops.length - 1]?.stopId);
      if (!fromStopId || !toStopId || stops.length < 2) {
        throw new BadRequestException("Lalamove chưa trả đủ điểm lấy và giao hàng hoàn.");
      }
      // Actual reverse shipment: customer is sender/pickup, shop is recipient/dropoff.
      placeWasAttempted = true;
      const orderResponse = await lalamoveRequest(cfg.request, "POST", "/v3/orders", {
        data: {
          quotationId,
          sender: {
            stopId: fromStopId,
            name: claimed.senderName,
            phone: normalizePhone(claimed.senderPhone, cfg.request.market),
          },
          recipients: [{
            stopId: toStopId,
            name: cfg.shopName,
            phone: normalizePhone(cfg.shopPhone, cfg.request.market),
          }],
          isPODEnabled: true,
          metadata: {
            kaitoKidOrderId: String(orderId),
            kaitoKidOrderCode: claimed.orderCode,
            shipmentDirection: "return",
          },
        },
      });
      const payload = await this.json(orderResponse);
      if (!orderResponse.ok) {
        // A non-2xx response cannot prove the provider did not create the order.
        throw new ServiceUnavailableException("Lalamove chưa xác nhận kết quả tạo vận đơn hoàn; cần đối soát.");
      }
      const data = asRecord(asRecord(payload).data);
      const externalId = asText(data.orderId);
      if (!externalId) throw new ServiceUnavailableException("Lalamove chưa trả mã vận đơn hoàn; cần đối soát.");
      const trackingUrl = asText(data.shareLink) || null;
      const now = new Date();
      await this.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE VanDonHoanHang SET MaVanDon = ?, MaBaoGia = ?, TrangThai = 'placed',
                  PhiVanChuyen = ?, LinkTheoDoi = ?, LoiCuoi = NULL, NgayCapNhat = ?
           WHERE DonHangId = ? AND TrangThai = 'placing'`,
          externalId, quotationId, fee, trackingUrl, now, orderId,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO LichSuTrangThaiVanChuyen (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
           VALUES (?, 'return_shipping_placed', ?, ?, ?)`,
          orderId, "Đã đặt vận đơn hoàn Lalamove: " + externalId + " (khách → shop)", actor, now,
        );
      });
      return this.get(orderId);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 280) : "Không thể tạo vận đơn hoàn";
      await this.db.$executeRawUnsafe(
        `UPDATE VanDonHoanHang
         SET TrangThai = ?, LoiCuoi = ?, NgayCapNhat = ?
         WHERE DonHangId = ? AND TrangThai = 'placing'`,
        placeWasAttempted ? "unknown" : "failed", message, new Date(), orderId,
      );
      throw error;
    }
  }

  /**
   * Called only AFTER the existing LalamoveShippingService has verified the
   * webhook HMAC. Correlate against return shipments (never the outbound order).
   * Always GET the provider again: a webhook event alone does not release money.
   */
  async reconcileVerifiedWebhook(externalOrderId: unknown): Promise<boolean> {
    const id = asText(externalOrderId);
    if (!id || id.length > 120) return false;
    const found = await this.db.$queryRawUnsafe<Array<{ orderId: unknown }>>(
      `SELECT DonHangId AS orderId FROM VanDonHoanHang
       WHERE NhaVanChuyen = 'lalamove' AND MaVanDon = ? LIMIT 1`,
      id,
    );
    const orderId = Number(found[0]?.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return false;
    await this.sync(orderId);
    return true;
  }

  async sync(orderId: number) {
    const current = await this.get(orderId);
    if (!current) throw new BadRequestException("Chưa có vận đơn hoàn.");
    if (!current.externalId || ["placing", "unknown", "failed"].includes(current.status)) {
      throw new BadRequestException("Vận đơn chưa có mã hợp lệ; cần đối soát hãng trước khi tiếp tục.");
    }
    if (current.status === "delivered") return current;
    const cfg = await this.config();
    if (!cfg.request.apiKey || !cfg.request.apiSecret) {
      throw new ServiceUnavailableException("Thiếu credentials Lalamove để xác minh giao hàng hoàn.");
    }
    const response = await lalamoveRequest(
      cfg.request, "GET", "/v3/orders/" + encodeURIComponent(current.externalId),
    );
    if (!response.ok) throw new ServiceUnavailableException("Không lấy được trạng thái vận đơn hoàn từ Lalamove.");
    const data = asRecord(asRecord(await this.json(response)).data);
    const providerOrderId = asText(data.orderId);
    if (!providerOrderId || providerOrderId !== current.externalId) {
      throw new ServiceUnavailableException("Mã vận đơn Lalamove không khớp bản ghi hoàn hàng.");
    }
    const nextStatus = carrierStatus(data.status);
    const nextTracking = asText(data.shareLink) || current.trackingUrl;
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE VanDonHoanHang
           SET TrangThai = ?, GiaoThanhCongLuc = CASE WHEN ? = 'delivered' THEN ? ELSE GiaoThanhCongLuc END,
               LinkTheoDoi = COALESCE(?, LinkTheoDoi), NgayCapNhat = ?
         WHERE DonHangId = ? AND MaVanDon = ? AND TrangThai <> 'delivered'`,
        nextStatus, nextStatus, now, nextTracking, now, orderId, current.externalId,
      );
      if (updated > 0 && nextStatus === "delivered") {
        await tx.$executeRawUnsafe(
          `INSERT INTO LichSuTrangThaiVanChuyen (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
           VALUES (?, 'return_shipping_delivered', ?, 'Lalamove', ?)`,
          orderId, "Lalamove xác nhận COMPLETED cho vận đơn hoàn " + current.externalId, now,
        );
      }
    });
    return this.get(orderId);
  }

  private async config(): Promise<Config> {
    const rows = await this.db.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT GiaTri AS value FROM CauHinhCuaHang
       WHERE NhomCauHinh='shipping' AND MaCauHinh='config' LIMIT 1`,
    );
    let raw: Record<string, unknown> = {};
    try { raw = asRecord(JSON.parse(rows[0]?.value || "{}")); } catch { /* missing config */ }
    const branchesRaw = valueOf(raw, "KaitoKidBranches");
    const branches = Array.isArray(branchesRaw) ? branchesRaw.map(asRecord) : [];
    const branch = branches.find((item) => Boolean(asText(valueOf(item, "Address")))) ?? {};
    const shopAddress = asText(valueOf(raw, "PickupAddress"))
      || asText(process.env.LALAMOVE_PICKUP_ADDRESS)
      || [valueOf(branch, "Address"), valueOf(branch, "District"), valueOf(branch, "Province")]
        .map(asText).filter(Boolean).join(", ");
    const market = asText(valueOf(raw, "LalamoveMarket"))
      || process.env.LALAMOVE_MARKET || "VN";
    return {
      enabled: valueOf(raw, "LalamoveEnabled") === true
        || String(valueOf(raw, "LalamoveEnabled")).toLowerCase() === "true",
      serviceType: asText(valueOf(raw, "LalamoveServiceType"))
        || process.env.LALAMOVE_SERVICE_TYPE || "MOTORCYCLE",
      shopAddress,
      shopName: asText(valueOf(raw, "PickupName"))
        || asText(valueOf(branch, "Name")) || "KaitoKid Shop",
      shopPhone: asText(valueOf(raw, "PickupPhone"))
        || asText(valueOf(branch, "Phone")),
      request: {
        baseUrl: asText(valueOf(raw, "LalamoveBaseUrl"))
          || process.env.LALAMOVE_BASE_URL || "https://rest.sandbox.lalamove.com",
        market,
        apiKey: process.env.LALAMOVE_API_KEY?.trim() || "",
        apiSecret: process.env.LALAMOVE_API_SECRET?.trim() || "",
      },
    };
  }

  private async json(response: Response): Promise<Record<string, unknown>> {
    const body = await response.text();
    if (!body) return {};
    try { return asRecord(JSON.parse(body)); }
    catch { return {}; }
  }
}
