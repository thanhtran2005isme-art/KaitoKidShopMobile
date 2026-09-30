import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!to.trim()) {
      this.logger.log(`Email skipped: empty recipient. Subject=${subject}`);
      return;
    }

    const apiKey = process.env.EMAIL_BREVO_API_KEY?.trim();
    if (!apiKey) {
      this.logger.log("====== EMAIL (mock) ======");
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(html);
      this.logger.log("==========================");
      return;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email:
            process.env.EMAIL_BREVO_SENDER_EMAIL ??
            "noreply@kaitokid.local",
          name:
            process.env.EMAIL_BREVO_SENDER_NAME ??
            "KaitoKid Shop",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch((error: unknown) => {
      this.logger.error(
        "Brevo exception",
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    });

    if (response && !response.ok) {
      const body = await response.text().catch(() => "");
      this.logger.warn(
        `Brevo gửi thất bại ${response.status}: ${body}`,
      );
    }
  }
}


export function orderConfirmationHtml(input: {
  customerName: string;
  orderCode: string;
  total: number;
  paymentMethod: string;
  trackingUrl: string;
}): string {
  const paymentLabel =
    input.paymentMethod.toUpperCase() === "COD"
      ? "Thanh toán khi nhận hàng"
      : "Chuyển khoản ngân hàng";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
    <h2>Cảm ơn ${escapeHtml(input.customerName)}!</h2>
    <p>Đơn hàng của bạn đã được ghi nhận tại KaitoKid.</p>
    <p>Mã đơn: <strong>${escapeHtml(input.orderCode)}</strong></p>
    <p>Tổng tiền: <strong>${formatVnd(input.total)}</strong></p>
    <p>Phương thức: ${escapeHtml(paymentLabel)}</p>
    <p><a href="${escapeHtml(input.trackingUrl)}">Theo dõi đơn hàng</a></p>
  </div>`;
}

export function paymentReceivedHtml(input: {
  customerName: string;
  orderCode: string;
  total: number;
}): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
    <h2>Đã nhận thanh toán</h2>
    <p>Xin chào ${escapeHtml(input.customerName)},</p>
    <p>Shop đã nhận được khoản thanh toán <strong>${formatVnd(input.total)}</strong> cho đơn <strong>${escapeHtml(input.orderCode)}</strong>.</p>
    <p>Đơn hàng đang được chuẩn bị và sẽ sớm được giao đến bạn.</p>
  </div>`;
}

function formatVnd(value: number): string {
  return `${Math.trunc(value).toLocaleString("vi-VN")}đ`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
