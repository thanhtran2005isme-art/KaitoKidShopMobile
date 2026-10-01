import { Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  boolValue,
  calculateMockQuote,
  estimateGhtkLeadHours,
  normalizeGhnName,
  normalizeProvince,
  numberValue,
  valueCaseInsensitive,
  type KaitoKidBranch,
  type ShippingConfig,
  type ShippingQuoteInput,
  type ShippingQuoteOption,
} from "./shipping.helpers.js";

interface SettingRow {
  value: string;
}

interface OrderForShipping {
  id: unknown;
  orderCode: string;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async getProviders() {
    const cfg = await this.loadConfig();
    return [
      {
        code: "mock",
        name: "KaitoKid (Tự giao)",
        enabled: cfg.mockEnabled,
        note: "Phí ship mô phỏng — không gọi API ngoài, dùng cho dev và demo.",
      },
      {
        code: "ghn",
        name: "Giao Hàng Nhanh",
        enabled:
          cfg.ghnEnabled &&
          Boolean(cfg.ghnToken) &&
          Boolean(cfg.ghnShopId),
        note: "Phí thật từ Giao Hàng Nhanh (chỉ tính phí, không tạo đơn thật).",
      },
      {
        code: "ghtk",
        name: "Giao Hàng Tiết Kiệm",
        enabled: cfg.ghtkEnabled && Boolean(cfg.ghtkToken),
        note: "Phí thật từ Giao Hàng Tiết Kiệm (chỉ tính phí, không tạo đơn thật).",
      },
    ];
  }

  async quote(req: ShippingQuoteInput) {
    if (!req.toProvince?.trim() || !req.toDistrict?.trim()) {
      return {
        success: false,
        message: "Thiếu tỉnh/quận giao hàng.",
        options: [] as ShippingQuoteOption[],
      };
    }

    const cfg = await this.loadConfig();
    const requested = (req.provider ?? "mock").trim().toLowerCase();
    const codes = requested === "all"
      ? ["mock", "ghn", "ghtk"]
      : ["mock", "ghn", "ghtk"].includes(requested)
        ? [requested]
        : ["mock"];

    const options: ShippingQuoteOption[] = [];
    for (const code of codes) {
      if (code === "mock" && cfg.mockEnabled) {
        options.push(...calculateMockQuote(req, cfg));
      } else if (
        code === "ghn" &&
        cfg.ghnEnabled &&
        cfg.ghnToken &&
        cfg.ghnShopId
      ) {
        options.push(...await this.quoteGhn(req, cfg));
      } else if (
        code === "ghtk" &&
        cfg.ghtkEnabled &&
        cfg.ghtkToken
      ) {
        options.push(...await this.quoteGhtk(req, cfg));
      }
    }

    if (options.length === 0) {
      options.push(...calculateMockQuote(req, cfg));
    }

    options.sort((a, b) => a.fee - b.fee);
    return {
      success: options.length > 0,
      message:
        options.length > 0
          ? null
          : "Không tính được phí ship cho địa chỉ này.",
      options,
    };
  }

  async track(userId: number, orderCode: string) {
    const orders = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         Id AS id, MaDonHang AS orderCode, MaVanDon AS trackingCode,
         NhaVanChuyen AS shippingProvider, LinkTracking AS trackingUrl,
         TrangThaiVanChuyen AS shippingStatus, TrangThai AS orderStatus,
         ThoiGianGiaoDuKien AS leadTimeHours, NgayTao AS createdAt
       FROM DonHang
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    const order = orders[0];
    if (!order) return null;

    const history = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         Id AS id, TrangThai AS status, MoTa AS description,
         ViTri AS location, ThoiGian AS time
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ?
       ORDER BY ThoiGian`,
      toNumber(order.id),
    );

    return {
      orderId: toNumber(order.id),
      orderCode: String(order.orderCode),
      maVanDon: order.trackingCode ?? null,
      nhaVanChuyen: order.shippingProvider ?? null,
      linkTracking: order.trackingUrl ?? null,
      trangThaiVanChuyen: order.shippingStatus ?? "pending",
      trangThaiDonHang: order.orderStatus,
      leadTimeHours:
        order.leadTimeHours === null ? null : toNumber(order.leadTimeHours),
      createdAt: order.createdAt,
      history: history.map((item) => ({
        id: toNumber(item.id),
        trangThai: item.status,
        moTa: item.description,
        viTri: item.location,
        thoiGian: item.time,
      })),
    };
  }

  async createShippingOrder(
    orderId: number,
    provider: string,
    serviceCode: string,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<OrderForShipping[]>(
        `SELECT Id AS id, MaDonHang AS orderCode
         FROM DonHang
         WHERE Id = ?
         LIMIT 1
         FOR UPDATE`,
        orderId,
      );
      const order = rows[0];
      if (!order) throw new Error("Đơn hàng không tồn tại.");

      const providers = await this.getProviders();
      const requested = (provider || "mock").trim().toLowerCase();
      const selected = providers.find((item) => item.code === requested)
        ?? providers.find((item) => item.code === "mock")!;
      const now = new Date();
      const stamp = [
        String(now.getUTCFullYear()).slice(-2),
        String(now.getUTCMonth() + 1).padStart(2, "0"),
        String(now.getUTCDate()).padStart(2, "0"),
      ].join("");
      const random = randomInt(100000, 1000000);
      const trackingCode =
        selected.code === "ghtk"
          ? `S-FAKE.${stamp}.${random}`
          : selected.code === "ghn"
            ? `GHN-FAKE-${stamp}-${random}`
            : `KK-SHIP-${stamp}-${random}`;

      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET MaVanDon = ?, NhaVanChuyen = ?, MaDichVuVanChuyen = ?,
             TrangThaiVanChuyen = 'ready_to_pick',
             LinkTracking = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        trackingCode,
        selected.code,
        serviceCode,
        `/orders/track/${order.orderCode}`,
        now,
        orderId,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO LichSuTrangThaiVanChuyen
           (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
         VALUES (?, 'ready_to_pick', ?, 'Kho KaitoKid', ?)`,
        orderId,
        `Đã tạo vận đơn ${trackingCode} với ${selected.name} (DEV)`,
        now,
      );

      return trackingCode;
    });
  }

  async appendHistory(
    orderId: number,
    status: string,
    description: string | null,
    location: string | null,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO LichSuTrangThaiVanChuyen
         (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
       VALUES (?, ?, ?, ?, ?)`,
      orderId,
      status,
      description,
      location,
      new Date(),
    );
  }

  async ghnLocations(
    provinceId?: number,
    districtId?: number,
  ): Promise<unknown> {
    const cfg = await this.loadConfig();
    if (!cfg.ghnToken) return { data: [] };

    const base = cfg.ghnBaseUrl.replace(/\/+$/, "");
    let url: string;
    let method: "GET" | "POST";
    let body: string | undefined;

    if (districtId !== undefined) {
      url = `${base}/shiip/public-api/master-data/ward?district_id=${districtId}`;
      method = "GET";
    } else if (provinceId !== undefined) {
      url = `${base}/shiip/public-api/master-data/district`;
      method = "POST";
      body = JSON.stringify({ province_id: provinceId });
    } else {
      url = `${base}/shiip/public-api/master-data/province`;
      method = "POST";
      body = "{}";
    }

    const response = await fetch(url, {
      method,
      headers: {
        Token: cfg.ghnToken,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return response.json();
  }

  private async loadConfig(): Promise<ShippingConfig> {
    const rows = await this.prisma.$queryRawUnsafe<SettingRow[]>(
      `SELECT GiaTri AS value
       FROM CauHinhCuaHang
       WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'
       LIMIT 1`,
    );

    let raw: Record<string, unknown> = {};
    if (rows[0]?.value) {
      try {
        raw = objectValue(JSON.parse(rows[0].value));
      } catch {
        raw = {};
      }
    }

    const branchesRaw = valueCaseInsensitive(raw, "KaitoKidBranches");
    const branches = Array.isArray(branchesRaw)
      ? branchesRaw.map((item): KaitoKidBranch | null => {
          const obj = objectValue(item);
          const code = textValue(valueCaseInsensitive(obj, "Code")) ?? "";
          const name = textValue(valueCaseInsensitive(obj, "Name")) ?? "";
          const province = textValue(valueCaseInsensitive(obj, "Province")) ?? "";
          if (!code && !name && !province) return null;
          return {
            code,
            name,
            province,
            district: textValue(valueCaseInsensitive(obj, "District")),
            address: textValue(valueCaseInsensitive(obj, "Address")),
            phone: textValue(valueCaseInsensitive(obj, "Phone")),
            active: boolValue(valueCaseInsensitive(obj, "Active"), true),
          };
        }).filter((item): item is KaitoKidBranch => item !== null)
      : [];

    return {
      mockEnabled: boolValue(valueCaseInsensitive(raw, "MockEnabled"), true),
      ghnEnabled: boolValue(valueCaseInsensitive(raw, "GhnEnabled"), true),
      ghtkEnabled: boolValue(valueCaseInsensitive(raw, "GhtkEnabled"), true),
      ghnBaseUrl:
        textValue(valueCaseInsensitive(raw, "GhnBaseUrl"))
        ?? process.env.GHN_BASE_URL
        ?? "https://dev-online-gateway.ghn.vn",
      ghnToken:
        textValue(valueCaseInsensitive(raw, "GhnToken"))
        ?? textValue(process.env.GHN_TOKEN),
      ghnShopId:
        textValue(valueCaseInsensitive(raw, "GhnShopId"))
        ?? textValue(process.env.GHN_SHOP_ID),
      ghnFromDistrictId:
        textValue(valueCaseInsensitive(raw, "GhnFromDistrictId"))
        ?? process.env.GHN_FROM_DISTRICT_ID
        ?? "1442",
      ghnToDistrictIdFallback:
        textValue(valueCaseInsensitive(raw, "GhnToDistrictIdFallback"))
        ?? process.env.GHN_TO_DISTRICT_ID_FALLBACK
        ?? "1454",
      ghnToWardCodeFallback:
        textValue(valueCaseInsensitive(raw, "GhnToWardCodeFallback"))
        ?? process.env.GHN_TO_WARD_CODE_FALLBACK
        ?? "21211",
      ghtkBaseUrl:
        textValue(valueCaseInsensitive(raw, "GhtkBaseUrl"))
        ?? process.env.GHTK_BASE_URL
        ?? "https://services.giaohangtietkiem.vn",
      ghtkToken:
        textValue(valueCaseInsensitive(raw, "GhtkToken"))
        ?? textValue(process.env.GHTK_TOKEN),
      ghtkPickProvince:
        textValue(valueCaseInsensitive(raw, "GhtkPickProvince"))
        ?? textValue(process.env.GHTK_PICK_PROVINCE),
      ghtkPickDistrict:
        textValue(valueCaseInsensitive(raw, "GhtkPickDistrict"))
        ?? textValue(process.env.GHTK_PICK_DISTRICT),
      kaitoKidBranches: branches,
      mockOnlyServeBranches: boolValue(
        valueCaseInsensitive(raw, "MockOnlyServeBranches"),
        true,
      ),
      mockFeeSameProvince: numberValue(
        valueCaseInsensitive(raw, "MockFeeSameProvince"),
        22_000,
      ),
      mockFeeNearbyProvince: numberValue(
        valueCaseInsensitive(raw, "MockFeeNearbyProvince"),
        35_000,
      ),
      mockFeeExpress: numberValue(
        valueCaseInsensitive(raw, "MockFeeExpress"),
        15_000,
      ),
      mockLeadTimeStandardHours: numberValue(
        valueCaseInsensitive(raw, "MockLeadTimeStandardHours"),
        6,
      ),
      mockLeadTimeExpressHours: numberValue(
        valueCaseInsensitive(raw, "MockLeadTimeExpressHours"),
        2,
      ),
    };
  }

  private async quoteGhtk(
    req: ShippingQuoteInput,
    cfg: ShippingConfig,
  ): Promise<ShippingQuoteOption[]> {
    if (!cfg.ghtkToken) return [];

    const params = new URLSearchParams({
      pick_province: cfg.ghtkPickProvince ?? "Hà Nội",
      pick_district: cfg.ghtkPickDistrict ?? "Cầu Giấy",
      province: req.toProvince,
      district: req.toDistrict,
      weight: String(Math.max(100, req.weightGram)),
      value: String(Math.trunc(req.orderValue)),
      transport: "road",
      deliver_option: req.deliverOption ?? "none",
    });
    if (req.toAddress?.trim()) params.set("address", req.toAddress.trim());

    try {
      const response = await fetch(
        `${cfg.ghtkBaseUrl.replace(/\/+$/, "")}/services/shipment/fee?${params}`,
        {
          headers: {
            Token: cfg.ghtkToken,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) return [];
      const data = await response.json() as Record<string, any>;
      if (!data.success || !data.fee) return [];

      return [{
        provider: "ghtk",
        serviceCode: String(data.fee.delivery_type ?? "standard"),
        serviceName: String(data.fee.name ?? "GHTK đường bộ"),
        fee: Number(data.fee.fee ?? 0),
        insuranceFee: Number(data.fee.insurance_fee ?? 0),
        leadTimeHours: estimateGhtkLeadHours(req.toProvince),
        deliveryType: "road",
      }];
    } catch {
      return [];
    }
  }

  private async quoteGhn(
    req: ShippingQuoteInput,
    cfg: ShippingConfig,
  ): Promise<ShippingQuoteOption[]> {
    if (!cfg.ghnToken || !cfg.ghnShopId) return [];
    const shopId = Number(cfg.ghnShopId);
    const fromDistrictId = Number(cfg.ghnFromDistrictId);
    if (!Number.isInteger(shopId) || !Number.isInteger(fromDistrictId)) return [];

    const resolved = await this.resolveGhnDestination(req, cfg);
    if (!resolved) return [];

    const base = cfg.ghnBaseUrl.replace(/\/+$/, "");
    try {
      const serviceResponse = await fetch(
        `${base}/shiip/public-api/v2/shipping-order/available-services`,
        {
          method: "POST",
          headers: {
            Token: cfg.ghnToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shop_id: shopId,
            from_district: fromDistrictId,
            to_district: resolved.districtId,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!serviceResponse.ok) return [];
      const serviceJson = await serviceResponse.json() as Record<string, any>;
      const services = Array.isArray(serviceJson.data) ? serviceJson.data : [];
      const result: ShippingQuoteOption[] = [];

      for (const service of services) {
        const feeResponse = await fetch(
          `${base}/shiip/public-api/v2/shipping-order/fee`,
          {
            method: "POST",
            headers: {
              Token: cfg.ghnToken,
              ShopId: String(shopId),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from_district_id: fromDistrictId,
              to_district_id: resolved.districtId,
              to_ward_code: resolved.wardCode,
              service_type_id: Number(service.service_type_id),
              weight: Math.max(100, req.weightGram),
              length: 20,
              width: 15,
              height: 10,
              insurance_value: 0,
            }),
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!feeResponse.ok) continue;
        const feeJson = await feeResponse.json() as Record<string, any>;
        if (!feeJson.data) continue;

        result.push({
          provider: "ghn",
          serviceCode: String(service.service_id),
          serviceName: String(
            service.short_name ?? service.service_type_name ?? "GHN",
          ),
          fee: Number(feeJson.data.total ?? 0),
          insuranceFee: Number(feeJson.data.insurance_fee ?? 0),
          leadTimeHours: Number(service.service_type_id) === 2 ? 24 : 48,
          deliveryType:
            Number(service.service_type_id) === 2 ? "fast" : "standard",
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  private async resolveGhnDestination(
    req: ShippingQuoteInput,
    cfg: ShippingConfig,
  ): Promise<{ districtId: number; wardCode: string } | null> {
    if (
      req.toDistrictId &&
      req.toWardCode?.trim()
    ) {
      return {
        districtId: req.toDistrictId,
        wardCode: req.toWardCode.trim(),
      };
    }

    const fallbackDistrict = Number(cfg.ghnToDistrictIdFallback);
    const fallbackWard = cfg.ghnToWardCodeFallback;
    if (!cfg.ghnToken) {
      return Number.isInteger(fallbackDistrict) && fallbackWard
        ? { districtId: fallbackDistrict, wardCode: fallbackWard }
        : null;
    }

    const base = cfg.ghnBaseUrl.replace(/\/+$/, "");
    try {
      const provinces = await this.ghnMasterPost(
        `${base}/shiip/public-api/master-data/province`,
        cfg.ghnToken,
        {},
      );
      const provinceTarget = normalizeGhnName(req.toProvince);
      const realProvinces = provinces.filter((item) => {
        const name = String(item.ProvinceName ?? item.province_name ?? "");
        return !/test/i.test(name) && !/\d/.test(name);
      });
      const province =
        realProvinces.find((item) =>
          normalizeGhnName(String(item.ProvinceName ?? item.province_name ?? ""))
          === provinceTarget
        ) ??
        realProvinces.find((item) =>
          normalizeGhnName(String(item.ProvinceName ?? item.province_name ?? ""))
            .includes(provinceTarget)
        ) ??
        realProvinces.find((item) =>
          provinceTarget.includes(
            normalizeGhnName(String(item.ProvinceName ?? item.province_name ?? "")),
          )
        );
      if (!province) throw new Error("province not found");

      const districts = await this.ghnMasterPost(
        `${base}/shiip/public-api/master-data/district`,
        cfg.ghnToken,
        { province_id: Number(province.ProvinceID ?? province.province_id) },
      );
      const districtTarget = normalizeGhnName(req.toDistrict);
      const district =
        districts.find((item) =>
          normalizeGhnName(String(item.DistrictName ?? item.district_name ?? ""))
          === districtTarget
        ) ??
        districts.find((item) =>
          normalizeGhnName(String(item.DistrictName ?? item.district_name ?? ""))
            .includes(districtTarget)
        ) ??
        districts.find((item) =>
          districtTarget.includes(
            normalizeGhnName(String(item.DistrictName ?? item.district_name ?? "")),
          )
        );
      if (!district) throw new Error("district not found");
      const districtId = Number(district.DistrictID ?? district.district_id);

      const response = await fetch(
        `${base}/shiip/public-api/master-data/ward?district_id=${districtId}`,
        {
          headers: { Token: cfg.ghnToken },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) throw new Error("ward request failed");
      const wardJson = await response.json() as Record<string, any>;
      const wards = Array.isArray(wardJson.data) ? wardJson.data : [];
      const targetWard = normalizeGhnName(req.toWard ?? "");
      const ward = targetWard
        ? wards.find((item: Record<string, any>) => {
            const normalized = normalizeGhnName(
              String(item.WardName ?? item.ward_name ?? ""),
            );
            return (
              normalized === targetWard ||
              normalized.includes(targetWard) ||
              targetWard.includes(normalized)
            );
          })
        : undefined;
      const fallbackDistrictWard = wards[0] as Record<string, any> | undefined;
      const wardCode = String(
        ward?.WardCode ??
        ward?.ward_code ??
        fallbackDistrictWard?.WardCode ??
        fallbackDistrictWard?.ward_code ??
        "",
      );

      if (Number.isInteger(districtId)) {
        return { districtId, wardCode };
      }
    } catch {
      // C# hiện tại cũng có fallback config khi không resolve được master-data.
    }

    return Number.isInteger(fallbackDistrict) && fallbackWard
      ? { districtId: fallbackDistrict, wardCode: fallbackWard }
      : null;
  }

  private async ghnMasterPost(
    url: string,
    token: string,
    body: Record<string, unknown>,
  ): Promise<Array<Record<string, any>>> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return [];
    const json = await response.json() as Record<string, any>;
    return Array.isArray(json.data) ? json.data : [];
  }
}
