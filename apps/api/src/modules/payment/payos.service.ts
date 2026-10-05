import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PayOS } from "@payos/node";
import QRCode from "qrcode";

interface PayOsSdkPaymentRequests {
  create(input: Record<string, unknown>): Promise<unknown>;
  get(orderCode: number): Promise<unknown>;
  cancel(orderCode: number, reason?: string): Promise<unknown>;
}

interface PayOsSdkWebhooks {
  verify(payload: unknown): Promise<unknown> | unknown;
}

interface PayOsSdkClient {
  paymentRequests: PayOsSdkPaymentRequests;
  webhooks: PayOsSdkWebhooks;
}

export interface PayOsPayment {
  orderCode: number;
  amount: number;
  status: string;
  paymentLinkId: string | null;
  checkoutUrl: string | null;
  qrCode: string | null;
  description: string | null;
  currency: string | null;
  bin: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

export interface PayOsWebhookData {
  orderCode: number;
  amount: number;
  code: string;
  desc: string;
  currency: string;
  paymentLinkId: string | null;
  reference: string | null;
  transactionDateTime: string | null;
}

export interface EnsurePayOsPaymentInput {
  orderCode: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentExpiresAt: Date | string | null;
}

interface CachedQrPayment {
  payment: PayOsPayment;
  expiresAtMs: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

const ORDER_SUFFIX_BASE = 0x1000000;
const QR_CACHE_FALLBACK_TTL_MS = 20 * 60_000;

@Injectable()
export class PayOsService {
  private sdk: PayOsSdkClient | null = null;
  private readonly ensureFlights = new Map<string, Promise<PayOsPayment>>();
  private readonly qrCache = new Map<number, CachedQrPayment>();

  isConfigured(): boolean {
    return Boolean(
      process.env.PAYOS_CLIENT_ID?.trim() &&
      process.env.PAYOS_API_KEY?.trim() &&
      process.env.PAYOS_CHECKSUM_KEY?.trim(),
    );
  }

  providerOrderCode(orderCode: string): number {
    const match = /^KK-(\d{8})-([0-9A-F]{6})$/i.exec(orderCode.trim());
    if (!match || !this.validDateKey(match[1])) {
      throw new BadRequestException("Mã đơn KaitoKid không hợp lệ cho payOS");
    }

    const day = Number(match[1]);
    const suffix = Number.parseInt(match[2], 16);
    const value = day * ORDER_SUFFIX_BASE + suffix;
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BadRequestException("Mã orderCode payOS vượt giới hạn an toàn");
    }
    return value;
  }

  kaitoKidOrderCode(providerOrderCode: number): string | null {
    if (!Number.isSafeInteger(providerOrderCode) || providerOrderCode <= 0) {
      return null;
    }
    const day = Math.floor(providerOrderCode / ORDER_SUFFIX_BASE);
    const suffix = providerOrderCode % ORDER_SUFFIX_BASE;
    const dayText = String(day).padStart(8, "0");
    if (!this.validDateKey(dayText)) return null;
    return `KK-${dayText}-${suffix.toString(16).toUpperCase().padStart(6, "0")}`;
  }

  async ensurePayment(input: EnsurePayOsPaymentInput): Promise<PayOsPayment> {
    const normalizedOrderCode = input.orderCode.trim().toUpperCase();
    const existingFlight = this.ensureFlights.get(normalizedOrderCode);
    if (existingFlight) return existingFlight;

    const flight = this.ensurePaymentOnce({
      ...input,
      orderCode: normalizedOrderCode,
    });
    this.ensureFlights.set(normalizedOrderCode, flight);

    try {
      return await flight;
    } finally {
      if (this.ensureFlights.get(normalizedOrderCode) === flight) {
        this.ensureFlights.delete(normalizedOrderCode);
      }
    }
  }

  private async ensurePaymentOnce(
    input: EnsurePayOsPaymentInput,
  ): Promise<PayOsPayment> {
    const providerOrderCode = this.providerOrderCode(input.orderCode);
    this.assertPaymentInput(providerOrderCode, input.amount);

    try {
      const existing = await this.getPayment(providerOrderCode);
      this.assertSameAmount(existing, input.amount);
      return existing;
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }

    const expires = input.paymentExpiresAt
      ? Math.floor(new Date(input.paymentExpiresAt).getTime() / 1000)
      : undefined;
    const suffix = input.orderCode.split("-").at(-1) ?? "ORDER";
    const description = `DH${suffix}`.slice(0, 9);
    const payload: Record<string, unknown> = {
      orderCode: providerOrderCode,
      amount: Math.round(input.amount),
      description,
      buyerName: input.customerName,
      buyerEmail: input.customerEmail,
      cancelUrl: this.callbackUrl("cancel", input.orderCode),
      returnUrl: this.callbackUrl("success", input.orderCode),
    };
    if (expires && Number.isFinite(expires)) payload.expiredAt = expires;

    try {
      const created = await this.client().paymentRequests.create(payload);
      const normalized = this.normalizePayment(created);
      this.assertSameAmount(normalized, input.amount);
      return this.rememberQr(normalized, input.paymentExpiresAt);
    } catch (error) {
      if (this.isAlreadyExists(error)) {
        const recovered = await this.recoverExistingPayment(
          providerOrderCode,
          input.amount,
        );
        if (recovered) return recovered;
      }
      throw this.providerError("Không thể tạo yêu cầu thanh toán payOS", error);
    }
  }

  async getPayment(providerOrderCode: number): Promise<PayOsPayment> {
    this.assertOrderId(providerOrderCode);
    try {
      const value = await this.client().paymentRequests.get(providerOrderCode);
      return this.mergeCachedQr(this.normalizePayment(value));
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException("Yêu cầu thanh toán payOS chưa tồn tại");
      }
      throw this.providerError("Không thể đọc trạng thái payOS", error);
    }
  }

  async cancelPayment(
    providerOrderCode: number,
    reason: string,
  ): Promise<PayOsPayment> {
    this.assertOrderId(providerOrderCode);
    try {
      const value = await this.client().paymentRequests.cancel(
        providerOrderCode,
        reason.slice(0, 255),
      );
      this.qrCache.delete(providerOrderCode);
      return this.normalizePayment(value);
    } catch (error) {
      throw this.providerError("Không thể hủy yêu cầu thanh toán payOS", error);
    }
  }

  async verifyWebhook(payload: unknown): Promise<PayOsWebhookData> {
    try {
      const value = await Promise.resolve(this.client().webhooks.verify(payload));
      const data = record(value);
      const orderCode = numberValue(data.orderCode);
      const amount = numberValue(data.amount);
      if (!Number.isSafeInteger(orderCode) || orderCode <= 0 || amount < 0) {
        throw new Error("Webhook payOS thiếu orderCode/amount hợp lệ");
      }
      return {
        orderCode,
        amount,
        code: text(data.code) ?? "",
        desc: text(data.desc) ?? "",
        currency: (text(data.currency) ?? "VND").toUpperCase(),
        paymentLinkId: text(data.paymentLinkId),
        reference: text(data.reference),
        transactionDateTime: text(data.transactionDateTime),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Webhook payOS không hợp lệ: ${error.message}`
          : "Webhook payOS không hợp lệ",
      );
    }
  }

  async qrDataUrl(payment: PayOsPayment): Promise<string | null> {
    // Chỉ raw qrCode do payOS trả từ CREATE mới là QR thanh toán ngân hàng.
    // checkoutUrl là URL web; encode URL đó thành QR sẽ khiến app ngân hàng báo
    // sai định dạng nên tuyệt đối không dùng làm fallback QR.
    if (!payment.qrCode) return null;
    return QRCode.toDataURL(payment.qrCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 420,
    });
  }

  private client(): PayOsSdkClient {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "payOS chưa được cấu hình trên backend",
      );
    }
    if (!this.sdk) {
      const client = new PayOS({
        clientId: process.env.PAYOS_CLIENT_ID!.trim(),
        apiKey: process.env.PAYOS_API_KEY!.trim(),
        checksumKey: process.env.PAYOS_CHECKSUM_KEY!.trim(),
        timeout: 15_000,
        maxRetries: 0,
        logLevel: process.env.PAYOS_LOG === "debug" ? "debug" : "error",
      });
      this.sdk = client as unknown as PayOsSdkClient;
    }
    return this.sdk;
  }

  private normalizePayment(value: unknown): PayOsPayment {
    const raw = record(value);
    const orderCode = numberValue(raw.orderCode);
    const paymentLinkId = text(raw.paymentLinkId) ?? text(raw.id);
    const checkoutUrl =
      text(raw.checkoutUrl) ??
      (paymentLinkId
        ? `https://pay.payos.vn/web/${encodeURIComponent(paymentLinkId)}`
        : null);
    return {
      orderCode,
      amount: numberValue(raw.amount),
      status: (text(raw.status) ?? "UNKNOWN").toUpperCase(),
      paymentLinkId,
      checkoutUrl,
      qrCode: text(raw.qrCode),
      description: text(raw.description),
      currency: text(raw.currency)?.toUpperCase() ?? "VND",
      bin: text(raw.bin),
      accountNumber: text(raw.accountNumber),
      accountName: text(raw.accountName),
    };
  }

  private rememberQr(
    payment: PayOsPayment,
    paymentExpiresAt: Date | string | null,
  ): PayOsPayment {
    if (!payment.qrCode || !Number.isSafeInteger(payment.orderCode)) return payment;
    const requestedExpiry = paymentExpiresAt
      ? new Date(paymentExpiresAt).getTime()
      : Number.NaN;
    const expiresAtMs = Number.isFinite(requestedExpiry)
      ? Math.max(Date.now() + 60_000, requestedExpiry + 60_000)
      : Date.now() + QR_CACHE_FALLBACK_TTL_MS;
    this.qrCache.set(payment.orderCode, { payment, expiresAtMs });
    return payment;
  }

  private mergeCachedQr(payment: PayOsPayment): PayOsPayment {
    const cached = this.qrCache.get(payment.orderCode);
    if (!cached) return payment;
    if (cached.expiresAtMs <= Date.now()) {
      this.qrCache.delete(payment.orderCode);
      return payment;
    }
    if (Math.round(cached.payment.amount) !== Math.round(payment.amount)) {
      this.qrCache.delete(payment.orderCode);
      return payment;
    }
    return {
      ...payment,
      qrCode: payment.qrCode ?? cached.payment.qrCode,
      checkoutUrl: payment.checkoutUrl ?? cached.payment.checkoutUrl,
      paymentLinkId: payment.paymentLinkId ?? cached.payment.paymentLinkId,
      description: payment.description ?? cached.payment.description,
      bin: payment.bin ?? cached.payment.bin,
      accountNumber: payment.accountNumber ?? cached.payment.accountNumber,
      accountName: payment.accountName ?? cached.payment.accountName,
    };
  }

  private async recoverExistingPayment(
    providerOrderCode: number,
    amount: number,
  ): Promise<PayOsPayment | null> {
    const delaysMs = [0, 250, 500, 1000, 2000, 4000];
    for (const delayMs of delaysMs) {
      if (delayMs > 0) await this.sleep(delayMs);
      try {
        const payment = await this.getPayment(providerOrderCode);
        this.assertSameAmount(payment, amount);
        return payment;
      } catch (error) {
        if (!this.isNotFound(error)) throw error;
      }
    }
    return null;
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private assertPaymentInput(providerOrderCode: number, amount: number): void {
    this.assertOrderId(providerOrderCode);
    if (!Number.isFinite(amount) || Math.round(amount) <= 0) {
      throw new BadRequestException("Số tiền thanh toán payOS phải lớn hơn 0");
    }
  }

  private assertOrderId(orderCode: number): void {
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      throw new BadRequestException("Mã orderCode payOS không hợp lệ");
    }
  }

  private assertSameAmount(payment: PayOsPayment, amount: number): void {
    if (Math.round(payment.amount) !== Math.round(amount)) {
      throw new BadRequestException(
        "Số tiền payOS không khớp tổng tiền đơn hàng",
      );
    }
  }

  private callbackUrl(kind: "success" | "cancel", orderCode: string): string {
    const envName = kind === "success" ? "PAYOS_RETURN_URL" : "PAYOS_CANCEL_URL";
    const explicit = process.env[envName]?.trim();
    if (explicit) return explicit;

    const base = (process.env.FRONTEND_BASE_URL ?? "http://localhost:5173").replace(
      /\/+$/,
      "",
    );
    const query = new URLSearchParams({ payment: kind, orderCode }).toString();
    return `${base}/orders?${query}`;
  }

  private validDateKey(value: string): boolean {
    if (!/^\d{8}$/.test(value)) return false;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      year >= 2000 &&
      year <= 2999 &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  private isNotFound(error: unknown): boolean {
    if (error instanceof NotFoundException) return true;
    const raw = record(error);
    const message = error instanceof Error ? error.message : String(error);
    return (
      numberValue(raw.status) === 404 ||
      numberValue(raw.code) === 101 ||
      /\bcode:\s*101\b/i.test(message)
    );
  }

  private isAlreadyExists(error: unknown): boolean {
    const raw = record(error);
    const message = error instanceof Error ? error.message : String(error);
    return (
      numberValue(raw.code) === 231 ||
      /\bcode:\s*231\b/i.test(message) ||
      /Đơn thanh toán đã tồn tại/i.test(message)
    );
  }

  private providerError(message: string, error: unknown): BadGatewayException {
    const detail = error instanceof Error ? error.message : String(error);
    return new BadGatewayException(`${message}: ${detail}`);
  }
}
