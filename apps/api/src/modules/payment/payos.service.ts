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
  orderId: number;
  orderCode: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentExpiresAt: Date | string | null;
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

@Injectable()
export class PayOsService {
  private sdk: PayOsSdkClient | null = null;

  isConfigured(): boolean {
    return Boolean(
      process.env.PAYOS_CLIENT_ID?.trim() &&
      process.env.PAYOS_API_KEY?.trim() &&
      process.env.PAYOS_CHECKSUM_KEY?.trim(),
    );
  }

  async ensurePayment(input: EnsurePayOsPaymentInput): Promise<PayOsPayment> {
    this.assertPaymentInput(input.orderId, input.amount);

    try {
      const existing = await this.getPayment(input.orderId);
      this.assertSameAmount(existing, input.amount);
      return existing;
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }

    const expires = input.paymentExpiresAt
      ? Math.floor(new Date(input.paymentExpiresAt).getTime() / 1000)
      : undefined;
    const description = `DH${input.orderId}`.slice(0, 9);
    const payload: Record<string, unknown> = {
      orderCode: input.orderId,
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
      return normalized;
    } catch (error) {
      // Create có thể timeout sau khi payOS đã nhận request. Lần request kế tiếp
      // luôn GET theo DonHang.Id trước nên không sinh orderCode thứ hai.
      throw this.providerError("Không thể tạo yêu cầu thanh toán payOS", error);
    }
  }

  async getPayment(orderId: number): Promise<PayOsPayment> {
    this.assertOrderId(orderId);
    try {
      const value = await this.client().paymentRequests.get(orderId);
      return this.normalizePayment(value);
    } catch (error) {
      if (this.isNotFound(error)) {
        // payOS API có thể trả HTTP 200 nhưng business code 101 khi orderCode
        // chưa có payment request. Chuẩn hóa về 404 nội bộ để ensure/cancel/expiry
        // đều hiểu đây là "chưa tạo payment", không phải provider outage.
        throw new NotFoundException("Yêu cầu thanh toán payOS chưa tồn tại");
      }
      throw this.providerError("Không thể đọc trạng thái payOS", error);
    }
  }

  async cancelPayment(orderId: number, reason: string): Promise<PayOsPayment> {
    this.assertOrderId(orderId);
    try {
      const value = await this.client().paymentRequests.cancel(
        orderId,
        reason.slice(0, 255),
      );
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
    // Create response có qrCode VietQR trực tiếp. GET hiện chỉ trả paymentLinkId,
    // nên khi reload dùng QR mở payOS Hosted Checkout làm fallback ổn định.
    const source = payment.qrCode || payment.checkoutUrl;
    if (!source) return null;
    return QRCode.toDataURL(source, {
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

  private assertPaymentInput(orderId: number, amount: number): void {
    this.assertOrderId(orderId);
    if (!Number.isFinite(amount) || Math.round(amount) <= 0) {
      throw new BadRequestException("Số tiền thanh toán payOS phải lớn hơn 0");
    }
  }

  private assertOrderId(orderId: number): void {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
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
    const query = new URLSearchParams({
      payment: kind,
      orderCode,
    }).toString();
    return `${base}/orders?${query}`;
  }

  private isNotFound(error: unknown): boolean {
    if (error instanceof NotFoundException) return true;
    const raw = record(error);
    return numberValue(raw.status) === 404 || numberValue(raw.code) === 101;
  }

  private providerError(message: string, error: unknown): BadGatewayException {
    const detail = error instanceof Error ? error.message : String(error);
    return new BadGatewayException(`${message}: ${detail}`);
  }
}
