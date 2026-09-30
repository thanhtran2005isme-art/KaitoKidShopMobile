import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { CouponService } from "../coupons/coupon.service.js";
import {
  isExpiredUnpaidOrder,
  paymentSecondsLeft,
} from "../orders/order.helpers.js";
import { OrderInventoryService } from "../orders/order-inventory.service.js";
import { ShippingService } from "../shipping/shipping.service.js";
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

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly inventory: OrderInventoryService,
    private readonly coupons: CouponService,
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
      vietQrConfigured: settings.bankAccounts.some(
        (account) => Boolean(account.qrImage?.trim()),
      ),
    };
  }

  async getInstructions(userId: number, orderCode: string) {
    const rows = await this.prisma.$queryRawUnsafe<PaymentOrderRow[]>(
      `${this.orderSelect()}
       WHERE MaDonHang = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderCode,
      userId,
    );
    const order = rows[0];
    if (!order) return null;
    if (order.paymentMethod.toUpperCase() !== "ATM") {
      throw new BadRequestException(
        "Đơn hàng không dùng chuyển khoản ngân hàng",
      );
    }

    const settings = await loadPaymentSettings(this.prisma);
    const bank = settings.bankAccounts[0];
    if (!bank) {
      throw new BadRequestException(
        "Shop chưa cấu hình tài khoản nhận chuyển khoản",
      );
    }

    return {
      orderCode: order.orderCode,
      total: toNumber(order.total),
      paymentExpiresAt: order.paymentExpiresAt,
      secondsLeft: paymentSecondsLeft(order.paymentExpiresAt),
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
        "Hết hạn thanh toán (15 phút) — đơn tự hủy",
        null,
      );
    }
    return this.statusDto(expired.order);
  }

  async cancelByCustomer(userId: number, orderCode: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PaymentOrderRow[]>(
        `${this.orderSelect()}
         WHERE MaDonHang = ? AND NguoiDungId = ?
         LIMIT 1
         FOR UPDATE`,
        orderCode,
        userId,
      );
      const order = rows[0];
      if (!order) return { found: false, cancelled: false, id: 0 };

      if (order.status !== "pending" || order.paidAt) {
        throw new BadRequestException(
          "Không thể hủy đơn ở trạng thái này",
        );
      }

      const id = toNumber(order.id);
      await this.inventory.restoreStockInTransaction(tx, id);
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
      return { found: true, cancelled: true, id };
    });

    if (!result.found) return null;
    if (result.cancelled) {
      await this.shipping.appendHistory(
        result.id,
        "cancelled",
        "Khách đã hủy giao dịch",
        null,
      );
    }
    return { message: "Đã hủy đơn hàng", orderCode };
  }

  async markPaid(orderCode: string) {
    return this.confirmPaid(orderCode, null, false);
  }

  async simulatePaid(userId: number, orderCode: string) {
    if (!this.allowSimulatePaid()) return { hidden: true as const };
    const result = await this.confirmPaid(orderCode, userId, true);
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
          "Hết hạn thanh toán (15 phút) — đơn tự hủy bởi sweeper",
          null,
        );
      }
    }
    return count;
  }

  private async confirmPaid(
    orderCode: string,
    ownerId: number | null,
    simulated: boolean,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const ownerFilter = ownerId === null ? "" : " AND NguoiDungId = ?";
      const params = ownerId === null ? [orderCode] : [orderCode, ownerId];
      const rows = await tx.$queryRawUnsafe<PaymentOrderRow[]>(
        `${this.orderSelect()}
         WHERE MaDonHang = ?${ownerFilter}
         LIMIT 1
         FOR UPDATE`,
        ...params,
      );
      const order = rows[0];
      if (!order) return null;
      if (order.paidAt) {
        return { order, alreadyPaid: true };
      }
      if (order.status === "cancelled") {
        throw new BadRequestException(
          simulated ? "Đơn đã hủy." : "Đơn đã bị hủy, không thể đánh dấu paid.",
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
      await this.shipping.appendHistory(
        toNumber(result.order.id),
        "payment_confirmed",
        simulated
          ? "Webhook ngân hàng (mô phỏng) báo đã nhận tiền"
          : "Đã xác nhận thanh toán — đơn chuyển sang confirmed",
        null,
      );

      if (
        result.order.paymentMethod.toUpperCase() === "ATM" &&
        !result.order.trackingCode
      ) {
        await this.shipping.createShippingOrder(
          toNumber(result.order.id),
          result.order.shippingProvider ?? "mock",
          result.order.shippingServiceCode ?? "standard",
        ).catch(() => undefined);
      }
    }

    return {
      message: result.alreadyPaid
        ? simulated
          ? "Đơn đã thanh toán."
          : "Đơn đã được đánh dấu paid trước đó."
        : simulated
          ? "Đã xác nhận thanh toán (mô phỏng webhook)"
          : "Đã xác nhận thanh toán",
      orderCode: result.order.orderCode,
      paidAt: result.order.paidAt,
    };
  }

  private async expireOwnedOrderIfNeeded(
    userId: number,
    orderCode: string,
  ) {
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
        isExpiredUnpaidOrder(
          order.status,
          order.paidAt,
          order.paymentExpiresAt,
          now,
        )
      ) {
        const id = toNumber(order.id);
        await this.inventory.restoreStockInTransaction(tx, id);
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
          order: { ...order, status: "cancelled", shippingStatus: "cancelled" },
          cancelled: true,
        };
      }
      return { order, cancelled: false };
    });
  }

  private statusDto(order: PaymentOrderRow) {
    return {
      orderCode: order.orderCode,
      status: order.status,
      paidAt: order.paidAt,
      paymentMethod: order.paymentMethod,
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
