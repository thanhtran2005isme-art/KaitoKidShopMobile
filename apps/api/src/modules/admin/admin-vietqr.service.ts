import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

export interface VietQrBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: boolean;
  lookupSupported: boolean;
}

export interface VietQrLookupResult {
  bank: VietQrBank;
  accountNumber: string;
  accountName: string;
}

interface VietQrBanksResponse {
  code?: string;
  desc?: string;
  data?: unknown;
}

interface VietQrLookupResponse {
  code?: string;
  desc?: string;
  data?: {
    accountName?: unknown;
  } | null;
}

const BANK_CACHE_MS = 24 * 60 * 60 * 1000;

function supportedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

@Injectable()
export class AdminVietQrService {
  private bankCache: { expiresAt: number; items: VietQrBank[] } | null = null;

  async getBanks(): Promise<VietQrBank[]> {
    if (this.bankCache && this.bankCache.expiresAt > Date.now()) {
      return this.bankCache.items;
    }

    const response = await fetch(`${this.baseUrl()}/banks`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);

    if (!response) {
      throw new ServiceUnavailableException(
        "Không kết nối được VietQR để tải danh sách ngân hàng.",
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `VietQR trả lỗi khi tải ngân hàng (HTTP ${response.status}).`,
      );
    }

    const payload = await response.json() as VietQrBanksResponse;
    if (payload.code !== "00" || !Array.isArray(payload.data)) {
      throw new BadGatewayException(
        payload.desc || "VietQR trả dữ liệu ngân hàng không hợp lệ.",
      );
    }

    const items = payload.data
      .map((item): VietQrBank | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const bin = text(row.bin);
        const shortName = text(row.shortName);
        const name = text(row.name);
        if (!/^\d{6}$/.test(bin) || !shortName || !name) return null;
        return {
          id: Number(row.id ?? 0),
          name,
          code: text(row.code),
          bin,
          shortName,
          logo: text(row.logo),
          transferSupported: supportedFlag(row.transferSupported),
          lookupSupported: supportedFlag(row.lookupSupported),
        };
      })
      .filter((item): item is VietQrBank => item !== null)
      .sort((left, right) =>
        left.shortName.localeCompare(right.shortName, "vi", { sensitivity: "base" })
      );

    this.bankCache = {
      expiresAt: Date.now() + BANK_CACHE_MS,
      items,
    };
    return items;
  }

  async lookupAccount(
    bankBinRaw: unknown,
    accountNumberRaw: unknown,
  ): Promise<VietQrLookupResult> {
    const bankBin = text(bankBinRaw);
    const accountNumber = text(accountNumberRaw);

    if (!/^\d{6}$/.test(bankBin)) {
      throw new BadRequestException("Ngân hàng chưa được chọn hoặc mã BIN không hợp lệ.");
    }
    if (!/^\d{6,19}$/.test(accountNumber)) {
      throw new BadRequestException(
        "Số tài khoản phải gồm 6–19 chữ số.",
      );
    }

    const banks = await this.getBanks();
    const bank = banks.find((item) => item.bin === bankBin);
    if (!bank) {
      throw new BadRequestException("Ngân hàng không có trong danh sách VietQR hiện tại.");
    }
    if (!bank.transferSupported || !bank.lookupSupported) {
      throw new BadRequestException(
        `${bank.shortName} hiện không hỗ trợ đầy đủ VietQR/tra cứu tài khoản. Vui lòng chọn ngân hàng khác.`,
      );
    }

    const clientId = process.env.VIETQR_CLIENT_ID?.trim();
    const apiKey = process.env.VIETQR_API_KEY?.trim();
    if (!clientId || !apiKey) {
      throw new ServiceUnavailableException(
        "Backend chưa cấu hình VIETQR_CLIENT_ID và VIETQR_API_KEY để xác minh tài khoản.",
      );
    }

    const response = await fetch(`${this.baseUrl()}/lookup`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        bin: Number(bankBin),
        accountNumber,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);

    if (!response) {
      throw new ServiceUnavailableException(
        "Không kết nối được VietQR để xác minh số tài khoản.",
      );
    }
    if (response.status === 429) {
      throw new HttpException(
        "VietQR đang giới hạn số lần tra cứu. Vui lòng thử lại sau.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `VietQR trả lỗi khi xác minh tài khoản (HTTP ${response.status}).`,
      );
    }

    const payload = await response.json() as VietQrLookupResponse;
    const accountName = text(payload.data?.accountName);
    if (payload.code !== "00" || !accountName) {
      throw new BadRequestException(
        payload.desc || "Không xác minh được số tài khoản tại ngân hàng đã chọn.",
      );
    }

    return {
      bank,
      accountNumber,
      accountName,
    };
  }

  private baseUrl(): string {
    return (
      process.env.VIETQR_BASE_URL?.trim() || "https://api.vietqr.io/v2"
    ).replace(/\/+$/, "");
  }
}
