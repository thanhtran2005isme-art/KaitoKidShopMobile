import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AuthEmailService, paymentReceivedHtml } from "../identity/email.service.js";
import { CouponService } from "../coupons/coupon.service.js";
import {
  isExpiredUnpaidOrder,
  paymentSecondsLeft,
} from "../orders/order.helpers.js";
import { OrderInventoryService } from "../orders/order-inventory.service.js";
import { ShippingService } from "../shipping/shipping.service.js";
import { PayOsService, type PayOsPayment } from "./payos.service.js";
import {
  loadPaymentSettings,
  type PaymentBankAccount,
} from "./payment-settings.js";

interface PaymentOrderRow {
  id: unknown;
  orderCode: string;
  userId: unknown;
  total: unknown;
  status: string;
  paidAt: Date | string | null;
  paymentMethod: string;
  paymentExpiresAt: Date | string | null;
  couponCode: string | null;
  trackingCode: string | null;
  shippingProvider: string | null;
  shippingServiceCode: string | null;
  customerEmail: string;
  customerName: string;
}

type PaymentConfirmSource =
  | "admin"
  | "simulated"
  | "payos_webhook"
  | "payos_reconcile";

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly inventory: OrderInventoryService,
    private readonly coupons: CouponService,
    private readonly email: AuthEmailService,
    private readonly payos: PayOsService,
  ) {}

  async getConfig() {
    const settings = await loadPaymentSettings(this.prisma);
    return {
      allowSimulatePaid: this.allowSimulatePaid(),
      supportedMethods: [
        ...(settings.enableCod ? ["COD"] : []),
        ...(settings.enableBank ? ["ATM"] : []),
      ],
      bankTransferConfigured: settings.enableBank,
      payOsConfigured: settings.enablePayOs,
      paymentProvider: settings.enablePayOs
        ? "payos"
        : settings.enableBank
          ? "legacy_bank"
          : null,
      vietQrConfigured:
        !settings.enablePayOs &&
        settings.bankAccounts.some((account) => Boolean(account.qrImage?.trim())),
    };
  }

  async getInstructions(userId: number, orderCode: string) {
    const order = await this.getOwnedOrder(userId, orderCode);
    if (!order) return null;
    if (order.paymentMethod.toUpperCase() !== "ATM") {
      throw new BadRequestException(
        "Đơn hàng không dùng thanh toán chuyển khoản/online",
      );
    }

    const settings = await loadPaymentSettings(this.prisma);
    if (settings.enablePayOs) {
      if (order.status === "cancelled") {
        throw new BadRequestException("Đơn hàng đã bị hủy");
      }

      const payment = await this.payos.ensurePayment({
        orderCode: order.orderCode,
        amount: toNumber(order.total),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        paymentExpiresAt: order.paymentExpiresAt,
      });
      const qrUrl = await this.payos.qrDataUrl(payment);
      const bank = this.payOsBankAccount(payment, settings.bankAccounts[0]);

      return {
        orderCode: order.orderCode,
        total: toNumber(order.total),
        paymentExpiresAt: order.paymentExpiresAt,
        secondsLeft: paymentSecondsLeft(order.paymentExpiresAt),
        provider: "payos",
        paymentLinkId: payment.paymentLinkId,
        paymentStatus: payment.status,
        checkoutUrl: payment.checkoutUrl,
        qrCode: payment.qrCode,
        qrMode: payment.qrCode ? "payos_vietqr" : "payos_checkout",
        transferContent:
          payment.description ?? `DH${order.orderCode.slice(-6)}`,
        bankAccount: bank,
        qrUrl,
      };
    }

    const bank = settings.bankAccounts[0];
    if (!bank) {
      throw new BadRequestException(
        "Shop chưa cấu hình phương thức thanh toán online",
      );
    }

    return {
      orderCode: order.orderCode,
      total: toNumber(order.total),
      paymentExpiresAt: order.paymentExpiresAt,
      secondsLeft: paymentSecondsLeft(order.paymentExpiresAt),
      provider: "legacy_bank",
      transferContent: `DH${order.orderCode}`,
      bankAccount: bank,
      qrUrl: bank.qrImage,
    };
  }

  async getStatus(userId: number, orderCode: string) {
    const expired = await this.expireOwnedOrderIfNeeded(userId, orderCode);
    if (!expired.order) return null;
    if (expired.cancelled) {
      await this.shipping.appendHistory(
        toNumber(expired.order.id),
        "cancelled",
        "Hết hạn thanh toán — provider đã xác nhận chưa nhận tiền; sản phẩm đã được trả lại giỏ",
        null,
      );
    }
    return this.statusDto(expired.order);
  }

  async handlePayOsWebhook(payload: unknown) {
    const verified = await this.payos.verifyWebhook(payload);
    const kaitoKidOrderCode = this.payos.kaitoKidOrderCode(verified.orderCode);

    // Sample webhook hoặc payment cũ dùng local AUTO_INCREMENT không thể map
    // sang MaDonHang mới: ACK/ignore, tuyệt đối không đoán theo DonHang.Id.
    if (!kaitoKidOrderCode) {
      return {
        received: true,
        ignored: true,
        reason: "unknown_order",
      };
    }

    const order = await this.getOrderByCode(kaitoKidOrderCode);
    if (!order) {
      return {
        received: true,
        ignored: true,
        reason: "unknown_order",
      };
    }

    if (order.paymentMethod.toUpperCase() !== "ATM") {
      throw new BadRequestException(
        "Webhook payOS không khớp phương thức thanh toán của đơn",
      );
    }
    if (verified.currency !== "VND") {
      throw new BadRequestException("Webhook payOS không dùng tiền tệ VND");
    }
    if (Math.round(verified.amount) !== Math.round(toNumber(order.total))) {
      throw new BadRequestException(
        "Số tiền webhook payOS không khớp tổng tiền đơn hàng",
      );
    }

    if (verified.code !== "00") {
      return {
        received: true,
        ignored: true,
        reason: "payment_not_successful",
      };
    }

    const result = await this.confirmPaidByOrderCode(
      order.orderCode,
      verified.amount,
      "payos_webhook",
    );
    return {
      received: true,
      paid: Boolean(result?.paidAt),
      orderCode: result?.orderCode ?? order.orderCode,
    };
  }

  async cancelByCustomer(userId: number, orderCode: string) {
    const current = await this.getOwnedOrder(userId, orderCode);
    if (!current) return null;
    if (current.status !== "pending" || current.paidAt) {
      throw new BadRequestException(
        "Không thể hủy đơn ở trạng thái này",
      );
    }

    if (
      current.paymentMethod.toUpperCase() === "ATM" &&
      this.payos.isConfigured()
    ) {
      const provider = await this.findPayOsPayment(current.orderCode);
      if (provider?.status === "PAID") {
        await this.confirmPaidByOrderCode(
          current.orderCode,
          toNumber(current.total),
          "payos_reconcile",
        );
        throw new BadRequestException(
          "payOS đã ghi nhận thanh toán, không thể hủy giao dịch",
        );
      }
      if (provider?.status === "PENDING") {
        const cancelled = await this.payos.cancelPayment(
          this.payos.providerOrderCode(current.orderCode),
          "Khach hang huy giao dich KaitoKid",
        );
        if (cancelled.status === "PAID") {
          await this.confirmPaidByOrderCode(
            current.orderCode,
            toNumber(current.total),
            "payos_reconcile",
          );
          throw new BadRequestException(
            "payOS đã ghi nhận thanh toán, không thể hủy giao dịch",
          );
        }
        if (cancelled.status !== "CANCELLED") {
          throw new BadRequestException(
            "payOS chưa xác nhận hủy giao dịch; KaitoKid chưa hoàn tồn kho/coupon",
          );
        }
      } else if (provider && provider.status !== "CANCELLED") {
        throw new BadRequestException(
          `Trạng thái payOS ${provider.status} chưa cho phép hủy đơn`,
        );
      }
    }

    const result = await this.cancelLocalOrder(userId, orderCode);
    if (!result) return null;
    await this.shipping.appendHistory(
      result.id,
      "cancelled",
      "Khách đã hủy giao dịch; sản phẩm đã được trả lại giỏ",
      null,
    );
    return { message: "Đã hủy đơn hàng", orderCode };
  }

  async markPaid(orderCode: string) {
    return this.confirmPaid(orderCode, null, "admin");
  }

  async simulatePaid(userId: number, orderCode: string) {
    if (!this.allowSimulatePaid()) return { hidden: true as const };
    const result = await this.confirmPaid(orderCode, userId, "simulated");
    return { hidden: false as const, result };
  }

  async sweepExpiredPayments(): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown;
      orderCode: string;
      userId: unknown;
    }>>(
      `SELECT Id AS id, MaDonHang AS orderCode, NguoiDungId AS userId
       FROM DonHang
       WHERE HetHanThanhToan IS NOT NULL
         AND HetHanThanhToan < ?
         AND TrangThai = 'pending'
         AND NgayThanhToan IS NULL
       ORDER BY Id`,
      new Date(),
    );

    let count = 0;
    for (const row of rows) {
      const result = await this.expireOwnedOrderIfNeeded(
        toNumber(row.userId),
        row.orderCode,
      );
      if (result.cancelled && result.order) {
        count += 1;
        await this.shipping.appendHistory(
          toNumber(result.order.id),
          "cancelled",
          "Hết hạn thanh toán — sweeper đã đối soát provider, hủy đơn và trả sản phẩm lại giỏ",
          null,
        );
      }
    }
    return count;
  }

  private async confirmPaid(
    orderCode: string,
    ownerId: number | null,
    source: PaymentConfirmSource,
  ) {
    return this.confirmPaidByLookup(
      { orderCode },
      ownerId,
      source,
      null,
    );
  }

  private async confirmPaidByOrderCode(
    orderCode: string,
    expectedAmount: number,
    source: PaymentConfirmSource,
  ) {
    return this.confirmPaidByLookup(
      { orderCode },
      null,
      source,
      expectedAmount,
    );
  }

  private async confirmPaidByLookup(
    lookup: { orderCode?: string; orderId?: number },
    ownerId: number | null,
    source: PaymentConfirmSource,
    expectedAmount: number | null,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const byId = lookup.orderId !== undefined;
      const lookupValue = byId ? lookup.orderId : lookup.orderCode;
      const ownerFilter = ownerId === null ? "" : " AND NguoiDungId = ?";
      const params = ownerId === null
        ? [lookupValue]
        : [lookupValue, ownerId];
      const rows = await tx.$queryRawUnsafe<PaymentOrderRow[]>(
        `${this.orderSelect()}
         WHERE ${byId ? "Id" : "MaDonHang"} = ?${ownerFilter}
         LIMIT 1
         FOR UPDATE`,
        ...params,
      );
      const order = rows[0];
      if (!order) return null;

      if (
        expectedAmount !== null &&
        Math.round(toNumber(order.total)) !== Math.round(expectedAmount)
      ) {
        throw new BadRequestException(
          "Số tiền xác nhận không khớp tổng tiền đơn hàng",
        );
      }
      if (
        source.startsWith("payos_") &&
        order.paymentMethod.toUpperCase() !== "ATM"
      ) {
        throw new BadRequestException(
          "payOS không được phép xác nhận đơn không dùng online payment",
        );
      }
      if (order.paidAt) {
        return { order, alreadyPaid: true };
      }
      if (order.status === "cancelled") {
        throw new BadRequestException(
          source === "simulated"
            ? "Đơn đã hủy."
            : "Đơn đã bị hủy, không thể đánh dấu paid.",
        );
      }

      const now = new Date();
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET NgayThanhToan = ?, TrangThai = 'confirmed',
             NgayCapNhat = ?
         WHERE Id = ?`,
        now,
        now,
        toNumber(order.id),
      );
      return {
        order: { ...order, paidAt: now, status: "confirmed" },
        alreadyPaid: false,
      };
    });
    if (!result) return null;

    if (!result.alreadyPaid) {
      await this.afterPaymentConfirmed(result.order, source);
    }

    return {
      message: result.alreadyPaid
        ? "Đơn đã được xác nhận thanh toán trước đó."
        : source === "simulated"
          ? "Đã xác nhận thanh toán (mô phỏng webhook)"
          : "Đã xác nhận thanh toán",
      orderCode: result.order.orderCode,
      paidAt: result.order.paidAt,
    };
  }

  private async afterPaymentConfirmed(
    order: PaymentOrderRow,
    source: PaymentConfirmSource,
  ): Promise<void> {
    const historyMessage =
      source === "payos_webhook"
        ? "payOS webhook đã xác nhận giao dịch thành công"
        : source === "payos_reconcile"
          ? "KaitoKid đối soát payOS và xác nhận giao dịch thành công"
          : source === "simulated"
            ? "Webhook thanh toán (mô phỏng) báo đã nhận tiền"
            : "Admin đã xác nhận thanh toán";

    await this.shipping.appendHistory(
      toNumber(order.id),
      "payment_confirmed",
      historyMessage,
      null,
    );

    if (
      order.paymentMethod.toUpperCase() === "ATM" &&
      !order.trackingCode
    ) {
      await this.shipping.createShippingOrder(
        toNumber(order.id),
        order.shippingProvider ?? "mock",
        order.shippingServiceCode ?? "standard",
      ).catch(() => undefined);
    }

    void this.email.send(
      order.customerEmail,
      `[KaitoKid] Đã nhận thanh toán đơn ${order.orderCode}`,
      paymentReceivedHtml({
        customerName: order.customerName,
        orderCode: order.orderCode,
        total: toNumber(order.total),
      }),
    ).catch(() => undefined);
  }

  private async expireOwnedOrderIfNeeded(
    userId: number,
    orderCode: string,
  ): Promise<{ order: PaymentOrderRow | null; cancelled: boolean }> {
    const order = await this.getOwnedOrder(userId, orderCode);
    if (!order) return { order: null, cancelled: false };

    const now = new Date();
    if (
      !isExpiredUnpaidOrder(
        order.status,
        order.paidAt,
        order.paymentExpiresAt,
        now,
      )
    ) {
      return { order, cancelled: false };
    }

    if (
      order.paymentMethod.toUpperCase() === "ATM" &&
      this.payos.isConfigured()
    ) {
      const provider = await this.findPayOsPayment(order.orderCode);
      if (provider?.status === "PAID") {
        await this.confirmPaidByOrderCode(
          order.orderCode,
          toNumber(order.total),
          "payos_reconcile",
        );
        return {
          order: await this.getOwnedOrder(userId, orderCode),
          cancelled: false,
        };
      }
      if (provider?.status === "PENDING") {
        const cancelled = await this.payos.cancelPayment(
          this.payos.providerOrderCode(order.orderCode),
          "Het han thanh toan KaitoKid",
        );
        if (cancelled.status === "PAID") {
          await this.confirmPaidByOrderCode(
            order.orderCode,
            toNumber(order.total),
            "payos_reconcile",
          );
          return {
            order: await this.getOwnedOrder(userId, orderCode),
            cancelled: false,
          };
        }
        if (cancelled.status !== "CANCELLED") {
          return { order, cancelled: false };
        }
      } else if (provider && provider.status !== "CANCELLED") {
        return { order, cancelled: false };
      }
    }

    return this.expireLocalOrder(userId, orderCode);
  }

  private async expireLocalOrder(
    userId: number,
    orderCode: string,
  ): Promise<{ order: PaymentOrderRow | null; cancelled: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PaymentOrderRow[]>(
        `${this.orderSelect()}
         WHERE MaDonHang = ? AND NguoiDungId = ?
         LIMIT 1
         FOR UPDATE`,
        orderCode,
        userId,
      );
      const order = rows[0];
      if (!order) return { order: null, cancelled: false };

      const now = new Date();
      if (
        !isExpiredUnpaidOrder(
          order.status,
          order.paidAt,
          order.paymentExpiresAt,
          now,
        )
      ) {
        return { order, cancelled: false };
      }

      const id = toNumber(order.id);
      await this.inventory.restoreStockAndCartInTransaction(tx, id, userId);
      await this.coupons.restoreUsageWithClient(tx, order.couponCode);
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'cancelled',
             TrangThaiVanChuyen = 'cancelled',
             NgayCapNhat = ?
         WHERE Id = ?`,
        now,
        id,
      );
      return {
        order: { ...order, status: "cancelled" },
        cancelled: true,
      };
    });
  }

  private async cancelLocalOrder(
    userId: number,
    orderCode: string,
  ): Promise<{ id: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PaymentOrderRow[]>(
        `${this.orderSelect()}
         WHERE MaDonHang = ? AND NguoiDungId = ?
         LIMIT 1
         FOR UPDATE`,
        orderCode,
        userId,
      );
      const order = rows[0];
      if (!order) return null;
      if (order.status !== "pending" || order.paidAt) {
        throw new BadRequestException(
          "Không thể hủy đơn ở trạng thái này",
        );
      }

      const id = toNumber(order.id);
      await this.inventory.restoreStockAndCartInTransaction(tx, id, userId);
      await this.coupons.restoreUsageWithClient(tx, order.couponCode);
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'cancelled',
             TrangThaiVanChuyen = 'cancelled',
             NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        id,
      );
      return { id };
    });
  }

  private async findPayOsPayment(orderCode: string): Promise<PayOsPayment | null> {
    try {
      return await this.payos.getPayment(
        this.payos.providerOrderCode(orderCode),
      );
    } catch (error) {
      if (this.providerStatus(error) === 404) return null;
      throw error;
    }
  }

  private providerStatus(error: unknown): number {
    if (!error || typeof error !== "object") return 0;
    const value = (error as Record<string, unknown>).status;
    return typeof value === "number" ? value : Number(value ?? 0);
  }

  private async getOwnedOrder(
    userId: number,
    orderCode: string,
  ): Promise<PaymentOrderRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<PaymentOrderRow[]>(
      `${this.orderSelect()}
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    return rows[0] ?? null;
  }

  private async getOrderByCode(
    orderCode: string,
  ): Promise<PaymentOrderRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<PaymentOrderRow[]>(
      `${this.orderSelect()}
       WHERE MaDonHang = ?
       LIMIT 1`,
      orderCode,
    );
    return rows[0] ?? null;
  }

  private payOsBankAccount(
    payment: PayOsPayment,
    legacyFallback?: PaymentBankAccount,
  ): PaymentBankAccount {
    if (payment.accountNumber && payment.accountName) {
      return {
        id: 0,
        bankName: payment.bin ? `payOS (${payment.bin})` : "payOS",
        accountNumber: payment.accountNumber,
        accountHolder: payment.accountName,
        branch: null,
        qrImage: null,
      };
    }
    if (legacyFallback) return legacyFallback;
    return {
      id: 0,
      bankName: "payOS",
      accountNumber: "Thanh toán trên payOS",
      accountHolder: "KaitoKid Shop",
      branch: null,
      qrImage: null,
    };
  }

  private statusDto(order: PaymentOrderRow) {
    return {
      orderCode: order.orderCode,
      status: order.status,
      paidAt: order.paidAt,
      paymentMethod: order.paymentMethod,
      paymentProvider:
        order.paymentMethod.toUpperCase() === "ATM" && this.payos.isConfigured()
          ? "payos"
          : null,
      paymentExpiresAt: order.paymentExpiresAt,
      secondsLeft: paymentSecondsLeft(order.paymentExpiresAt),
      total: toNumber(order.total),
    };
  }

  private allowSimulatePaid(): boolean {
    return (
      process.env.NODE_ENV?.toLowerCase() === "development" ||
      /^(1|true|yes)$/i.test(
        process.env.PAYMENT_ALLOW_SIMULATE_PAID ?? "false",
      )
    );
  }

  private orderSelect(): string {
    return `SELECT
      Id AS id, MaDonHang AS orderCode, NguoiDungId AS userId,
      TongTien AS total, TrangThai AS status, NgayThanhToan AS paidAt,
      PhuongThucThanhToan AS paymentMethod,
      HetHanThanhToan AS paymentExpiresAt, MaGiamGia AS couponCode,
      MaVanDon AS trackingCode, NhaVanChuyen AS shippingProvider,
      MaDichVuVanChuyen AS shippingServiceCode,
      Email AS customerEmail, TenNguoiNhan AS customerName
    FROM DonHang`;
  }
}
