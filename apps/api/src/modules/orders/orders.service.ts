import { BadRequestException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AuthEmailService, orderConfirmationHtml } from "../identity/email.service.js";
import { evaluateComboRows } from "../cart/combo-discount.helpers.js";
import { distinctPositiveIds } from "../cart/cart.helpers.js";
import { CouponService } from "../coupons/coupon.service.js";
import { loadPaymentSettings } from "../payment/payment-settings.js";
import { ShippingService } from "../shipping/shipping.service.js";
import {
  canCancelOrder,
  canonicalShippingAddress,
  hasReviewedVariant,
  reviewedKey,
} from "./order.helpers.js";
import { OrderInventoryService } from "./order-inventory.service.js";

interface CreateOrderInput {
  cartItemIds?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  customerAddress?: unknown;
  paymentMethod?: unknown;
  couponCode?: unknown;
  note?: unknown;
  shippingProvider?: unknown;
  shippingServiceCode?: unknown;
  shippingProvince?: unknown;
  shippingDistrict?: unknown;
  shippingWard?: unknown;
  shippingStreet?: unknown;
}

interface CartCheckoutRow {
  id: unknown;
  productId: unknown;
  size: string;
  color: string;
  quantity: unknown;
  reservedUntil: Date | string | null;
  name: string;
  price: unknown;
  image: string;
  category: string;
  productStock: unknown;
  productReserved: unknown;
  productStatus: string;
}

interface VariantRow {
  id: unknown;
  productId: unknown;
  size: string;
  color: string;
  stock: unknown;
  reserved: unknown;
}

interface OrderRow {
  id: unknown;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  subtotal: unknown;
  shippingFee: unknown;
  discount: unknown;
  total: unknown;
  couponCode: string | null;
  paymentMethod: string;
  status: string;
  note: string | null;
  createdAt: Date | string;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippingStatus: string | null;
  shippingProvider: string | null;
  shippingServiceCode: string | null;
  leadTimeHours: unknown;
  paymentExpiresAt: Date | string | null;
  paidAt: Date | string | null;
}

interface OrderItemRow {
  orderId: unknown;
  productId: unknown;
  productName: string;
  productImage: string;
  price: unknown;
  size: string;
  color: string;
  quantity: unknown;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponService,
    private readonly shipping: ShippingService,
    private readonly inventory: OrderInventoryService,
    private readonly email: AuthEmailService,
  ) {}

  async createOrder(userId: number, input: CreateOrderInput) {
    const selectedIds = this.parseSelectedIds(input.cartItemIds);

    // Quote shipping phải chạy ngoài interactive transaction để không giữ
    // row-lock trong lúc chờ GHN/GHTK. Sau đó transaction revalidate snapshot.
    const snapshot = await this.loadCheckoutCart(
      this.prisma,
      userId,
      selectedIds,
    );
    if (selectedIds && snapshot.length !== selectedIds.length) {
      throw new BadRequestException(
        "Một số sản phẩm đã không còn trong giỏ. Vui lòng tải lại giỏ hàng.",
      );
    }
    if (snapshot.length === 0) {
      throw new BadRequestException("Giỏ hàng trống");
    }

    const snapshotNow = new Date();
    if (
      snapshot.some(
        (item) =>
          item.reservedUntil &&
          new Date(item.reservedUntil).getTime() <= snapshotNow.getTime(),
      )
    ) {
      throw new BadRequestException(
        "Thời gian giữ hàng đã hết. Vui lòng tải lại giỏ hàng để kiểm tra tồn kho.",
      );
    }

    const province = this.text(input.shippingProvince);
    const district = this.text(input.shippingDistrict);
    const ward = this.text(input.shippingWard);
    const street = this.text(input.shippingStreet);
    if (!province || !district || !ward || !street) {
      throw new BadRequestException("Địa chỉ giao hàng chưa đầy đủ.");
    }

    let shippingProvider = this.text(input.shippingProvider, "mock").toLowerCase();
    let shippingServiceCode = this.text(input.shippingServiceCode, "standard");
    const snapshotSubtotal = this.cartSubtotal(snapshot);
    const snapshotWeight = this.cartWeight(snapshot);
    const quote = await this.shipping.quote({
      provider: shippingProvider,
      toProvince: province,
      toDistrict: district,
      toWard: ward,
      toAddress: street,
      weightGram: snapshotWeight,
      orderValue: snapshotSubtotal,
    });
    const quotedShipping = quote.options.find(
      (option) =>
        option.provider.toLowerCase() === shippingProvider &&
        option.serviceCode.toLowerCase() === shippingServiceCode.toLowerCase(),
    );
    if (!quote.success || !quotedShipping) {
      throw new BadRequestException(
        "Gói vận chuyển đã thay đổi. Vui lòng tính lại phí và chọn lại phương thức giao hàng.",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRawUnsafe<Array<{ email: string }>>(
        "SELECT Email AS email FROM NguoiDung WHERE Id = ? LIMIT 1 FOR UPDATE",
        userId,
      );
      if (!users[0]) {
        throw new BadRequestException("Tài khoản không còn tồn tại.");
      }

      const cartRows = await this.loadCheckoutCart(tx, userId, selectedIds);
      if (selectedIds && cartRows.length !== selectedIds.length) {
        throw new BadRequestException(
          "Một số sản phẩm đã không còn trong giỏ. Vui lòng tải lại giỏ hàng.",
        );
      }
      if (cartRows.length === 0) {
        throw new BadRequestException("Giỏ hàng trống");
      }

      const productIds = [...new Set(
        cartRows.map((item) => toNumber(item.productId)),
      )].sort((a, b) => a - b);
      await this.lockInventory(tx, productIds);

      const lockedCart = await this.loadCheckoutCart(
        tx,
        userId,
        selectedIds,
        true,
      );
      if (
        lockedCart.length !== cartRows.length ||
        (selectedIds && lockedCart.length !== selectedIds.length)
      ) {
        throw new BadRequestException(
          "Một số sản phẩm đã không còn trong giỏ. Vui lòng tải lại giỏ hàng.",
        );
      }

      const lockedNow = new Date();
      if (
        lockedCart.some(
          (item) =>
            item.reservedUntil &&
            new Date(item.reservedUntil).getTime() <= lockedNow.getTime(),
        )
      ) {
        throw new BadRequestException(
          "Thời gian giữ hàng đã hết. Vui lòng tải lại giỏ hàng để kiểm tra tồn kho.",
        );
      }

      const subtotal = this.cartSubtotal(lockedCart);
      const weight = this.cartWeight(lockedCart);
      if (
        subtotal !== snapshotSubtotal ||
        weight !== snapshotWeight ||
        !this.sameCartIdentity(snapshot, lockedCart)
      ) {
        throw new BadRequestException(
          "Giỏ hàng đã thay đổi. Vui lòng tải lại và tính lại phí vận chuyển.",
        );
      }

      const paymentMethod = this.text(input.paymentMethod, "COD").toUpperCase();
      if (paymentMethod !== "COD" && paymentMethod !== "ATM") {
        throw new BadRequestException("Phương thức thanh toán không được hỗ trợ.");
      }
      const paymentSettings = await loadPaymentSettings(tx);
      if (paymentMethod === "COD" && !paymentSettings.enableCod) {
        throw new BadRequestException("Thanh toán COD hiện đang tạm tắt.");
      }
      if (paymentMethod === "ATM" && !paymentSettings.enableBank) {
        throw new BadRequestException(
          "Chuyển khoản ngân hàng hiện chưa được cấu hình.",
        );
      }

      const customerName = this.text(input.customerName);
      const customerPhone = this.text(input.customerPhone);
      const requestedEmail = this.text(input.customerEmail);
      const customerEmail = requestedEmail || users[0].email.trim();

      if (customerName.length < 2) {
        throw new BadRequestException("Tên người nhận không hợp lệ.");
      }
      if ((customerPhone.match(/\d/g) ?? []).length < 9) {
        throw new BadRequestException("Số điện thoại người nhận không hợp lệ.");
      }
      if (!customerEmail) {
        throw new BadRequestException("Email tài khoản không hợp lệ.");
      }

      const variants = await this.loadVariants(tx, productIds);
      for (const item of lockedCart) {
        if (item.productStatus !== "active") {
          throw new BadRequestException(
            `Sản phẩm ${item.name} hiện không còn được bán.`,
          );
        }
        const quantity = toNumber(item.quantity);
        if (quantity < 1 || toNumber(item.productStock) < quantity) {
          throw new BadRequestException(
            `Sản phẩm ${item.name} không còn đủ tồn kho.`,
          );
        }

        const productVariants = variants.filter(
          (variant) => toNumber(variant.productId) === toNumber(item.productId),
        );
        if (productVariants.length > 0) {
          const variant = productVariants.find(
            (value) =>
              value.size === item.size &&
              value.color === item.color,
          );
          if (!variant || toNumber(variant.stock) < quantity) {
            throw new BadRequestException(
              `Biến thể ${item.size} - ${item.color} của ${item.name} không còn đủ tồn kho.`,
            );
          }
        }
      }

      let couponDiscount = 0;
      let couponCode: string | null = null;
      const rawCoupon = this.text(input.couponCode);
      if (rawCoupon) {
        const normalized = rawCoupon.toUpperCase();
        const coupon = await this.coupons.validateWithClient(
          tx,
          normalized,
          subtotal,
          true,
        );
        if (!coupon.isValid) {
          throw new BadRequestException(
            coupon.message || "Mã giảm giá không còn hợp lệ.",
          );
        }
        couponDiscount = coupon.discountAmount;
        couponCode = normalized;
      }

      const combo = evaluateComboRows(
        lockedCart.map((item) => ({
          productId: toNumber(item.productId),
          category: item.category,
          price: toNumber(item.price),
          quantity: toNumber(item.quantity),
        })),
      );
      const comboDiscount = combo.eligible ? combo.discount : 0;
      const totalDiscount = couponDiscount + comboDiscount;

      // Provider/service đã quote ngoài transaction; cart/address đã revalidate.
      shippingProvider = quotedShipping.provider;
      shippingServiceCode = quotedShipping.serviceCode;
      const shippingFee = quotedShipping.fee;
      const total = Math.max(
        0,
        subtotal - totalDiscount + shippingFee,
      );
      const now = new Date();
      const orderCode = this.orderCode(now);
      const paymentExpiresAt =
        paymentMethod === "ATM"
          ? new Date(now.getTime() + 15 * 60_000)
          : null;
      const customerAddress = canonicalShippingAddress(
        street,
        ward,
        district,
        province,
      );
      const note = this.text(input.note) || null;

      await tx.$executeRawUnsafe(
        `INSERT INTO DonHang
           (MaDonHang, NguoiDungId, TenNguoiNhan, SoDienThoai, Email,
            DiaChiGiao, TamTinh, PhiVanChuyen, GiamGia, TongTien,
            MaGiamGia, PhuongThucThanhToan, TrangThai, GhiChu,
            NhaVanChuyen, MaDichVuVanChuyen, ThoiGianGiaoDuKien,
            HetHanThanhToan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        orderCode,
        userId,
        customerName,
        customerPhone,
        customerEmail,
        customerAddress,
        subtotal,
        shippingFee,
        totalDiscount,
        total,
        couponCode,
        paymentMethod,
        note,
        shippingProvider,
        shippingServiceCode,
        quotedShipping.leadTimeHours,
        paymentExpiresAt,
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      const orderId = toNumber(ids[0]?.id);

      for (const item of lockedCart) {
        const productId = toNumber(item.productId);
        const quantity = toNumber(item.quantity);
        await tx.$executeRawUnsafe(
          `INSERT INTO ChiTietDonHang
             (DonHangId, SanPhamId, TenSanPham, HinhAnhSP,
              DonGia, KichCo, MauSac, SoLuong)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          orderId,
          productId,
          item.name,
          item.image,
          toNumber(item.price),
          item.size,
          item.color,
          quantity,
        );

        await tx.$executeRawUnsafe(
          `UPDATE SanPham
           SET TrangThai = CASE
                 WHEN TonKho - ? <= 0 THEN 'out-of-stock'
                 ELSE TrangThai
               END,
               TonKho = TonKho - ?,
               SoLuongDaGiu = GREATEST(0, COALESCE(SoLuongDaGiu,0) - ?),
               SoLuongDaBan = SoLuongDaBan + ?,
               NgayCapNhat = ?
           WHERE Id = ?`,
          quantity,
          quantity,
          quantity,
          quantity,
          now,
          productId,
        );

        const variant = variants.find(
          (value) =>
            toNumber(value.productId) === productId &&
            value.size === item.size &&
            value.color === item.color,
        );
        if (variant) {
          await tx.$executeRawUnsafe(
            `UPDATE TonKhoBienThe
             SET SoLuong = GREATEST(0, SoLuong - ?),
                 SoLuongDaGiu = GREATEST(0, COALESCE(SoLuongDaGiu,0) - ?),
                 SoLuongDaBan = SoLuongDaBan + ?,
                 NgayCapNhat = ?
             WHERE Id = ?`,
            quantity,
            quantity,
            quantity,
            now,
            toNumber(variant.id),
          );
        }
      }

      const cartIds = lockedCart.map((item) => toNumber(item.id));
      await tx.$executeRawUnsafe(
        `DELETE FROM GioHang
         WHERE NguoiDungId = ?
           AND Id IN (${this.marks(cartIds.length)})`,
        userId,
        ...cartIds,
      );

      if (couponCode) {
        await this.coupons.incrementUsageWithClient(tx, couponCode);
      }

      return {
        orderId,
        orderCode,
        paymentMethod,
        shippingProvider,
        shippingServiceCode,
      };
    });

    await this.shipping.appendHistory(
      result.orderId,
      "order_placed",
      `Đơn hàng ${result.orderCode} đã được tạo`,
      "Hệ thống KaitoKid",
    );

    if (result.paymentMethod === "COD") {
      await this.shipping.createShippingOrder(
        result.orderId,
        result.shippingProvider,
        result.shippingServiceCode,
      ).catch(() => undefined);
    }

    const order = await this.getOrderById(userId, result.orderId);
    if (!order) throw new Error("Không thể đọc lại đơn hàng vừa tạo.");

    const frontendUrl = (
      process.env.FRONTEND_BASE_URL ?? "http://localhost:5173"
    ).replace(/\/+$/, "");
    void this.email.send(
      order.customerEmail,
      `[KaitoKid] Xác nhận đơn hàng ${order.orderCode}`,
      orderConfirmationHtml({
        customerName: order.customerName,
        orderCode: order.orderCode,
        total: order.total,
        paymentMethod: order.paymentMethod,
        trackingUrl: `${frontendUrl}/orders`,
      }),
    ).catch(() => undefined);

    return order;
  }

  async getOrdersByUser(userId: number) {
    const orders = await this.prisma.$queryRawUnsafe<OrderRow[]>(
      `${this.orderSelect()}
       WHERE NguoiDungId = ?
       ORDER BY NgayTao DESC`,
      userId,
    );
    return this.mapOrders(userId, orders);
  }

  async getOrderById(userId: number, orderId: number) {
    const rows = await this.prisma.$queryRawUnsafe<OrderRow[]>(
      `${this.orderSelect()}
       WHERE Id = ? AND NguoiDungId = ?
       LIMIT 1`,
      orderId,
      userId,
    );
    if (!rows[0]) return null;
    const mapped = await this.mapOrders(userId, rows);
    return mapped[0] ?? null;
  }

  async cancelOrder(userId: number, orderId: number): Promise<boolean> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        id: unknown;
        status: string;
        shippingStatus: string | null;
        couponCode: string | null;
      }>>(
        `SELECT Id AS id, TrangThai AS status,
                TrangThaiVanChuyen AS shippingStatus,
                MaGiamGia AS couponCode
         FROM DonHang
         WHERE Id = ? AND NguoiDungId = ?
         LIMIT 1
         FOR UPDATE`,
        orderId,
        userId,
      );
      const order = rows[0];
      if (!order || !canCancelOrder(order.status, order.shippingStatus)) {
        return false;
      }

      await this.inventory.restoreStockInTransaction(tx, orderId);
      await this.coupons.restoreUsageWithClient(tx, order.couponCode);
      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'cancelled',
             TrangThaiVanChuyen = 'cancelled',
             NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        orderId,
      );
      return true;
    });

    if (cancelled) {
      await this.shipping.appendHistory(
        orderId,
        "cancelled",
        "Khách hàng đã hủy đơn",
        null,
      );
    }
    return cancelled;
  }

  private async mapOrders(userId: number, orders: OrderRow[]) {
    if (orders.length === 0) return [];
    const orderIds = orders.map((order) => toNumber(order.id));
    const items = await this.prisma.$queryRawUnsafe<OrderItemRow[]>(
      `SELECT DonHangId AS orderId, SanPhamId AS productId,
              TenSanPham AS productName, HinhAnhSP AS productImage,
              DonGia AS price, KichCo AS size, MauSac AS color,
              SoLuong AS quantity
       FROM ChiTietDonHang
       WHERE DonHangId IN (${this.marks(orderIds.length)})
       ORDER BY Id`,
      ...orderIds,
    );
    const reviews = await this.prisma.$queryRawUnsafe<Array<{
      orderId: unknown;
      productId: unknown;
      size: string | null;
      color: string | null;
    }>>(
      `SELECT DonHangId AS orderId, SanPhamId AS productId,
              KichCo AS size, MauSac AS color
       FROM DanhGia
       WHERE NguoiDungId = ?
         AND DonHangId IN (${this.marks(orderIds.length)})`,
      userId,
      ...orderIds,
    );
    const reviewed = new Set(
      reviews.map((review) =>
        reviewedKey(
          toNumber(review.orderId),
          toNumber(review.productId),
          review.size,
          review.color,
        ),
      ),
    );

    return orders.map((order) => {
      const orderId = toNumber(order.id);
      return {
        id: orderId,
        orderCode: order.orderCode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        subtotal: toNumber(order.subtotal),
        shippingFee: toNumber(order.shippingFee),
        discount: toNumber(order.discount),
        total: toNumber(order.total),
        couponCode: order.couponCode,
        paymentMethod: order.paymentMethod,
        status: order.status,
        canCancel: canCancelOrder(order.status, order.shippingStatus),
        note: order.note,
        createdAt: order.createdAt,
        trackingCode: order.trackingCode,
        trackingUrl: order.trackingUrl,
        shippingStatus: order.shippingStatus,
        shippingProvider: order.shippingProvider,
        shippingServiceCode: order.shippingServiceCode,
        leadTimeHours:
          order.leadTimeHours === null ? null : toNumber(order.leadTimeHours),
        paymentExpiresAt: order.paymentExpiresAt,
        paidAt: order.paidAt,
        items: items
          .filter((item) => toNumber(item.orderId) === orderId)
          .map((item) => ({
            productId: toNumber(item.productId),
            productName: item.productName,
            productImage: item.productImage,
            price: toNumber(item.price),
            size: item.size,
            color: item.color,
            quantity: toNumber(item.quantity),
            hasReviewed: hasReviewedVariant(
              reviewed,
              orderId,
              toNumber(item.productId),
              item.size,
              item.color,
            ),
          })),
      };
    });
  }

  private async loadCheckoutCart(
    tx: SqlClient,
    userId: number,
    selectedIds: number[] | null,
    forUpdate = false,
  ): Promise<CartCheckoutRow[]> {
    const filter = selectedIds
      ? ` AND c.Id IN (${this.marks(selectedIds.length)})`
      : "";
    const params: unknown[] = [userId, ...(selectedIds ?? [])];
    return tx.$queryRawUnsafe<CartCheckoutRow[]>(
      `SELECT
         c.Id AS id, c.SanPhamId AS productId, c.KichCo AS size,
         c.MauSac AS color, c.SoLuong AS quantity, c.GiuDenLuc AS reservedUntil,
         p.TenSanPham AS name, p.Gia AS price, p.HinhAnh AS image,
         p.DanhMuc AS category, p.TonKho AS productStock,
         COALESCE(p.SoLuongDaGiu,0) AS productReserved,
         p.TrangThai AS productStatus
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       WHERE c.NguoiDungId = ?${filter}
       ORDER BY c.Id${forUpdate ? " FOR UPDATE" : ""}`,
      ...params,
    );
  }

  private async lockInventory(tx: SqlClient, productIds: number[]) {
    if (productIds.length === 0) return;
    const marks = this.marks(productIds.length);
    await tx.$queryRawUnsafe(
      `SELECT Id FROM SanPham
       WHERE Id IN (${marks})
       ORDER BY Id
       FOR UPDATE`,
      ...productIds,
    );
    await tx.$queryRawUnsafe(
      `SELECT Id FROM TonKhoBienThe
       WHERE SanPhamId IN (${marks})
       ORDER BY SanPhamId, Id
       FOR UPDATE`,
      ...productIds,
    );
  }

  private loadVariants(tx: SqlClient, productIds: number[]) {
    if (productIds.length === 0) return Promise.resolve([] as VariantRow[]);
    return tx.$queryRawUnsafe<VariantRow[]>(
      `SELECT Id AS id, SanPhamId AS productId, KichCo AS size,
              MauSac AS color, SoLuong AS stock,
              COALESCE(SoLuongDaGiu,0) AS reserved
       FROM TonKhoBienThe
       WHERE SanPhamId IN (${this.marks(productIds.length)})
       ORDER BY SanPhamId, Id`,
      ...productIds,
    );
  }

  private cartSubtotal(items: CartCheckoutRow[]): number {
    return items.reduce(
      (sum, item) => sum + toNumber(item.price) * toNumber(item.quantity),
      0,
    );
  }

  private cartWeight(items: CartCheckoutRow[]): number {
    return Math.max(
      300,
      items.reduce(
        (sum, item) => sum + toNumber(item.quantity) * 300,
        0,
      ),
    );
  }

  private sameCartIdentity(
    left: CartCheckoutRow[],
    right: CartCheckoutRow[],
  ): boolean {
    const signature = (items: CartCheckoutRow[]) =>
      items
        .map((item) => [
          toNumber(item.id),
          toNumber(item.productId),
          item.size,
          item.color,
          toNumber(item.quantity),
          toNumber(item.price),
        ].join(":"))
        .sort()
        .join("|");
    return signature(left) === signature(right);
  }

  private parseSelectedIds(raw: unknown): number[] | null {
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException("Bạn chưa chọn sản phẩm để thanh toán.");
    }
    const numeric = raw.map((value) => Number(value));
    if (numeric.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
      throw new BadRequestException(
        "Danh sách sản phẩm checkout không hợp lệ hoặc đã thay đổi.",
      );
    }
    return distinctPositiveIds(numeric);
  }

  private text(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value.trim() : fallback;
  }

  private orderCode(now: Date): string {
    const date = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ].join("");
    return `KK-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private orderSelect(): string {
    return `SELECT
      Id AS id, MaDonHang AS orderCode, TenNguoiNhan AS customerName,
      SoDienThoai AS customerPhone, Email AS customerEmail,
      DiaChiGiao AS customerAddress, TamTinh AS subtotal,
      PhiVanChuyen AS shippingFee, GiamGia AS discount,
      TongTien AS total, MaGiamGia AS couponCode,
      PhuongThucThanhToan AS paymentMethod, TrangThai AS status,
      GhiChu AS note, NgayTao AS createdAt,
      MaVanDon AS trackingCode, LinkTracking AS trackingUrl,
      TrangThaiVanChuyen AS shippingStatus,
      NhaVanChuyen AS shippingProvider,
      MaDichVuVanChuyen AS shippingServiceCode,
      ThoiGianGiaoDuKien AS leadTimeHours,
      HetHanThanhToan AS paymentExpiresAt,
      NgayThanhToan AS paidAt
    FROM DonHang`;
  }

  private marks(count: number): string {
    return Array.from({ length: count }, () => "?").join(",");
  }
}
