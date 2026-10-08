import { createHmac, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface SettingRow {
  value: string;
}

function ci(source: Record<string, unknown>, key: string): unknown {
  const target = key.toLowerCase();
  return Object.entries(source).find(
    ([name]) => name.toLowerCase() === target,
  )?.[1];
}

function str(source: Record<string, unknown>, key: string, fallback = "") {
  const value = ci(source, key);
  return typeof value === "string" ? value : fallback;
}

function bool(source: Record<string, unknown>, key: string, fallback: boolean) {
  const value = ci(source, key);
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^true$/i.test(value)) return true;
  if (typeof value === "string" && /^false$/i.test(value)) return false;
  return fallback;
}

function num(source: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(ci(source, key));
  return Number.isFinite(value) ? value : fallback;
}

export function maskShippingSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4);
}

@Injectable()
export class AdminShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(maskSecrets = true) {
    const raw = await this.rawConfig();
    const lalamoveApiKey = process.env.LALAMOVE_API_KEY?.trim() ?? "";
    const lalamoveApiSecret = process.env.LALAMOVE_API_SECRET?.trim() ?? "";
    const result = {
      mockEnabled: bool(raw, "MockEnabled", true),
      ghnEnabled: bool(raw, "GhnEnabled", true),
      ghtkEnabled: bool(raw, "GhtkEnabled", true),
      lalamoveEnabled: bool(raw, "LalamoveEnabled", false),
      ghnBaseUrl:
        str(raw, "GhnBaseUrl") ||
        process.env.GHN_BASE_URL ||
        "https://dev-online-gateway.ghn.vn",
      ghnToken:
        str(raw, "GhnToken") || process.env.GHN_TOKEN || "",
      ghnShopId:
        str(raw, "GhnShopId") || process.env.GHN_SHOP_ID || "",
      ghnFromDistrictId:
        str(raw, "GhnFromDistrictId") ||
        process.env.GHN_FROM_DISTRICT_ID ||
        "1442",
      ghnToDistrictIdFallback:
        str(raw, "GhnToDistrictIdFallback") ||
        process.env.GHN_TO_DISTRICT_ID_FALLBACK ||
        "1454",
      ghnToWardCodeFallback:
        str(raw, "GhnToWardCodeFallback") ||
        process.env.GHN_TO_WARD_CODE_FALLBACK ||
        "21211",
      ghtkBaseUrl:
        str(raw, "GhtkBaseUrl") ||
        process.env.GHTK_BASE_URL ||
        "https://services.giaohangtietkiem.vn",
      ghtkToken:
        str(raw, "GhtkToken") || process.env.GHTK_TOKEN || "",
      ghtkPickProvince:
        str(raw, "GhtkPickProvince") ||
        process.env.GHTK_PICK_PROVINCE ||
        "",
      ghtkPickDistrict:
        str(raw, "GhtkPickDistrict") ||
        process.env.GHTK_PICK_DISTRICT ||
        "",
      lalamoveBaseUrl:
        str(raw, "LalamoveBaseUrl") ||
        process.env.LALAMOVE_BASE_URL ||
        "https://rest.sandbox.lalamove.com",
      lalamoveMarket:
        str(raw, "LalamoveMarket") || process.env.LALAMOVE_MARKET || "VN",
      lalamoveServiceType:
        str(raw, "LalamoveServiceType") ||
        process.env.LALAMOVE_SERVICE_TYPE ||
        "MOTORCYCLE",
      lalamoveApiKeyConfigured: Boolean(lalamoveApiKey),
      lalamoveApiSecretConfigured: Boolean(lalamoveApiSecret),
      pickupAddress:
        str(raw, "PickupAddress") || process.env.LALAMOVE_PICKUP_ADDRESS || "",
      pickupName: str(raw, "PickupName"),
      pickupPhone: str(raw, "PickupPhone"),
      defaultWeightGram: num(raw, "DefaultWeightGram", 300),
      kaitoKidBranches: Array.isArray(ci(raw, "KaitoKidBranches"))
        ? ci(raw, "KaitoKidBranches")
        : [],
      mockOnlyServeBranches: bool(raw, "MockOnlyServeBranches", true),
      mockFeeSameProvince: num(raw, "MockFeeSameProvince", 22_000),
      mockFeeNearbyProvince: num(raw, "MockFeeNearbyProvince", 35_000),
      mockFeeExpress: num(raw, "MockFeeExpress", 15_000),
      mockLeadTimeStandardHours: num(
        raw,
        "MockLeadTimeStandardHours",
        6,
      ),
      mockLeadTimeExpressHours: num(
        raw,
        "MockLeadTimeExpressHours",
        2,
      ),
    };
    return maskSecrets
      ? {
          ...result,
          ghnToken: maskShippingSecret(result.ghnToken),
          ghtkToken: maskShippingSecret(result.ghtkToken),
        }
      : result;
  }

  async updateConfig(input: Record<string, unknown>) {
    const current = await this.getConfig(false);
    const {
      lalamoveApiKeyConfigured: _lalamoveApiKeyConfigured,
      lalamoveApiSecretConfigured: _lalamoveApiSecretConfigured,
      ...currentPersisted
    } = current;
    const {
      lalamoveApiKeyConfigured: _inputLalamoveApiKeyConfigured,
      lalamoveApiSecretConfigured: _inputLalamoveApiSecretConfigured,
      ...safeInput
    } = input;
    const next = {
      ...currentPersisted,
      ...safeInput,
      ghnToken: this.keepSecret(input.ghnToken, current.ghnToken),
      ghtkToken: this.keepSecret(input.ghtkToken, current.ghtkToken),
    };
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO CauHinhCuaHang
         (MaCauHinh, GiaTri, NhomCauHinh, MoTa, NgayCapNhat)
       VALUES ('config', ?, 'shipping', 'Cấu hình vận chuyển', ?)
       ON DUPLICATE KEY UPDATE
         GiaTri=VALUES(GiaTri),
         NhomCauHinh='shipping',
         MoTa=VALUES(MoTa),
         NgayCapNhat=VALUES(NgayCapNhat)`,
      JSON.stringify(next),
      new Date(),
    );
  }

  async testProvider(providerRaw: string) {
    const provider = providerRaw.trim().toLowerCase();
    const cfg = await this.getConfig(false);
    if (provider === "mock") {
      return { ok: true, message: "Mock luôn sẵn sàng (offline)." };
    }
    if (provider === "ghn") {
      if (!cfg.ghnToken) {
        return { ok: false, badRequest: true, message: "Chưa cấu hình GHN Token." };
      }
      try {
        const base = cfg.ghnBaseUrl.replace(/\/+$/, "");
        const response = await fetch(
          `${base}/shiip/public-api/master-data/province`,
          {
            method: "POST",
            headers: {
              Token: cfg.ghnToken,
              "Content-Type": "application/json",
            },
            body: "{}",
            signal: AbortSignal.timeout(15_000),
          },
        );
        const text = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: text,
          };
        }
        let count = 0;
        try {
          const parsed = JSON.parse(text);
          count = Array.isArray(parsed?.data) ? parsed.data.length : 0;
        } catch {
          count = 0;
        }
        return {
          ok: true,
          status: 200,
          message: `GHN OK — ${count} tỉnh`,
          baseUrl: cfg.ghnBaseUrl,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    if (provider === "ghtk") {
      if (!cfg.ghtkToken) {
        return {
          ok: false,
          badRequest: true,
          message: "Chưa cấu hình GHTK Token.",
        };
      }
      try {
        const base = cfg.ghtkBaseUrl.replace(/\/+$/, "");
        const params = new URLSearchParams({
          pick_province: "Hà Nội",
          pick_district: "Cầu Giấy",
          province: "Hà Nội",
          district: "Đống Đa",
          weight: "200",
          value: "300000",
        });
        const response = await fetch(
          `${base}/services/shipment/fee?${params}`,
          {
            headers: { Token: cfg.ghtkToken },
            signal: AbortSignal.timeout(15_000),
          },
        );
        const text = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: text,
          };
        }
        return {
          ok: true,
          status: 200,
          message: "GHTK OK",
          baseUrl: cfg.ghtkBaseUrl,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    if (provider === "lalamove") {
      const apiKey = process.env.LALAMOVE_API_KEY?.trim() ?? "";
      const apiSecret = process.env.LALAMOVE_API_SECRET?.trim() ?? "";
      if (!apiKey || !apiSecret) {
        return {
          ok: false,
          badRequest: true,
          message:
            "Chưa cấu hình LALAMOVE_API_KEY/LALAMOVE_API_SECRET trong môi trường backend.",
        };
      }
      try {
        const base = cfg.lalamoveBaseUrl.replace(/\/+$/, "");
        const path = "/v3/cities";
        const timestamp = Date.now().toString();
        const rawSignature = `${timestamp}\r\nGET\r\n${path}\r\n\r\n`;
        const signature = createHmac("sha256", apiSecret)
          .update(rawSignature)
          .digest("hex");
        const response = await fetch(`${base}${path}`, {
          headers: {
            Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
            Market: cfg.lalamoveMarket,
            "Request-ID": randomUUID(),
          },
          signal: AbortSignal.timeout(15_000),
        });
        const text = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: text,
          };
        }
        let count = 0;
        try {
          const parsed = JSON.parse(text);
          count = Array.isArray(parsed?.data) ? parsed.data.length : 0;
        } catch {
          count = 0;
        }
        return {
          ok: true,
          status: 200,
          message: `Lalamove OK — ${count} khu vực cho market ${cfg.lalamoveMarket}`,
          baseUrl: cfg.lalamoveBaseUrl,
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return {
      ok: false,
      badRequest: true,
      message: `Provider không hỗ trợ: ${providerRaw}`,
    };
  }

  async ghnMaster(provinceId?: number) {
    const cfg = await this.getConfig(false);
    if (!cfg.ghnToken) {
      return { badRequest: true, error: "Chưa cấu hình GHN Token." };
    }
    const base = cfg.ghnBaseUrl.replace(/\/+$/, "");
    const url = provinceId
      ? `${base}/shiip/public-api/master-data/district`
      : `${base}/shiip/public-api/master-data/province`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Token: cfg.ghnToken,
          "Content-Type": "application/json",
        },
        body: provinceId
          ? JSON.stringify({ province_id: provinceId })
          : "{}",
        signal: AbortSignal.timeout(15_000),
      });
      return {
        status: response.status,
        contentType:
          response.headers.get("content-type") ?? "application/json",
        body: await response.text(),
      };
    } catch (error) {
      return {
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  async history(input: {
    search?: string;
    provider?: string;
    status?: string;
    page: number;
    pageSize: number;
  }) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (input.search?.trim()) {
      const like = `%${input.search.trim()}%`;
      where.push(
        "(o.MaDonHang LIKE ? OR o.MaVanDon LIKE ? OR o.TenNguoiNhan LIKE ? OR o.SoDienThoai LIKE ?)",
      );
      values.push(like, like, like, like);
    }
    if (input.provider?.trim()) {
      where.push("o.NhaVanChuyen=?");
      values.push(input.provider.trim());
    }
    if (input.status?.trim()) {
      where.push("h.TrangThai=?");
      values.push(input.status.trim());
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const page = Math.max(1, input.page);
    const pageSize = Math.max(1, Math.min(100, input.pageSize));
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      `SELECT COUNT(*) AS total
       FROM LichSuTrangThaiVanChuyen h
       JOIN DonHang o ON o.Id=h.DonHangId
       ${clause}`,
      ...values,
    );
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT h.Id AS id, h.DonHangId AS orderId,
              o.MaDonHang AS orderCode, o.MaVanDon AS trackingCode,
              o.NhaVanChuyen AS provider, h.TrangThai AS status,
              h.MoTa AS description, h.ViTri AS location,
              h.ThoiGian AS time, o.TrangThai AS orderStatus,
              o.TongTien AS total, o.TenNguoiNhan AS customerName,
              o.SoDienThoai AS customerPhone
       FROM LichSuTrangThaiVanChuyen h
       JOIN DonHang o ON o.Id=h.DonHangId
       ${clause}
       ORDER BY h.ThoiGian DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ...values,
    );
    return {
      items: rows.map((row) => ({
        ...row,
        id: toNumber(row.id),
        orderId: toNumber(row.orderId),
        total: toNumber(row.total),
      })),
      total: toNumber(totals[0]?.total),
      page,
      pageSize,
    };
  }

  async overview() {
    const [providers, statuses, totals] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ provider: string; count: unknown }>>(
        `SELECT NhaVanChuyen AS provider, COUNT(*) AS count
         FROM DonHang
         WHERE NhaVanChuyen IS NOT NULL
         GROUP BY NhaVanChuyen`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ status: string; count: unknown }>>(
        `SELECT TrangThaiVanChuyen AS status, COUNT(*) AS count
         FROM DonHang
         WHERE TrangThaiVanChuyen IS NOT NULL
         GROUP BY TrangThaiVanChuyen`,
      ),
      this.prisma.$queryRawUnsafe<Array<{
        totalOrders: unknown;
        totalShipped: unknown;
      }>>(
        `SELECT COUNT(*) AS totalOrders,
                SUM(CASE WHEN TrangThaiVanChuyen IS NOT NULL THEN 1 ELSE 0 END)
                  AS totalShipped
         FROM DonHang`,
      ),
    ]);
    return {
      totalOrders: toNumber(totals[0]?.totalOrders),
      totalShipped: toNumber(totals[0]?.totalShipped),
      byProvider: providers.map((x) => ({
        provider: x.provider,
        count: toNumber(x.count),
      })),
      byStatus: statuses.map((x) => ({
        status: x.status,
        count: toNumber(x.count),
      })),
    };
  }

  private async rawConfig(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.$queryRawUnsafe<SettingRow[]>(
      `SELECT GiaTri AS value
       FROM CauHinhCuaHang
       WHERE NhomCauHinh='shipping' AND MaCauHinh='config'
       LIMIT 1`,
    );
    if (!rows[0]?.value) return {};
    try {
      const value = JSON.parse(rows[0].value);
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  }

  private keepSecret(value: unknown, current: string) {
    if (typeof value !== "string" || !value || value.includes("*")) {
      return current;
    }
    return value;
  }
}
