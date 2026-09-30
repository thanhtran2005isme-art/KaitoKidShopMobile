import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import {
  availableStock,
  calculateReservationUpdate,
  containsOrdinalIgnoreCase,
  distinctPositiveIds,
  groupReservationRelease,
  normalizeCartOption,
  parseCartOptionList,
  reservationExpiresAt,
  type ReservationReleaseItem,
} from "./cart.helpers.js";

interface SqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
}

interface CartProductRow {
  id: unknown;
  name: string;
  category: string;
  price: unknown;
  image: string;
  stock: unknown;
  reserved: unknown;
  status: string;
  colors: string | null;
  sizes: string | null;
}

interface VariantRow {
  id: unknown;
  stock: unknown;
  reserved: unknown;
  size: string;
  color: string;
}

interface CartDbRow {
  id: unknown;
  productId: unknown;
  size: string;
  color: string;
  quantity: unknown;
  reservedUntil: Date | string | null;
}

interface CartViewRow extends CartDbRow {
  name: string;
  price: unknown;
  image: string;
  productStock: unknown;
  productReserved: unknown;
  variantId: unknown | null;
  variantStock: unknown | null;
  variantReserved: unknown | null;
}

interface OrderItemRow {
  productId: unknown;
  productName: string;
  size: string;
  color: string;
  quantity: unknown;
}

const PRODUCT_LIST_SELECT = `
  SELECT
    p.Id AS id,
    p.TenSanPham AS name,
    p.DanhMuc AS category,
    p.DanhMucPhu AS subcategory,
    p.GioiTinh AS gender,
    p.Gia AS price,
    p.GiaCu AS oldPrice,
    p.TonKho AS stock,
    COALESCE(p.SoLuongDaGiu, 0) AS reserved,
    p.TrangThai AS status,
    p.HinhAnh AS image,
    p.MoTaNgan AS shortDescription,
    p.MaSanPham AS sku,
    p.Slug AS slug,
    p.LaSanPhamMoi AS isNew,
    p.DangGiamGia AS isSale,
    p.BanChayNhat AS isBestSeller,
    p.DiemDanhGia AS rating,
    p.SoLuongDaBan AS soldCount,
    p.DanhSachMau AS colors,
    p.DanhSachSize AS sizes
  FROM SanPham p
`;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<CartViewRow[]>(
      `SELECT
         c.Id AS id, c.SanPhamId AS productId, c.KichCo AS size,
         c.MauSac AS color, c.SoLuong AS quantity, c.GiuDenLuc AS reservedUntil,
         p.TenSanPham AS name, p.Gia AS price, p.HinhAnh AS image,
         p.TonKho AS productStock, COALESCE(p.SoLuongDaGiu, 0) AS productReserved,
         v.Id AS variantId, v.SoLuong AS variantStock,
         COALESCE(v.SoLuongDaGiu, 0) AS variantReserved
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       LEFT JOIN TonKhoBienThe v ON v.Id = (
         SELECT v2.Id
         FROM TonKhoBienThe v2
         WHERE v2.SanPhamId = c.SanPhamId
           AND v2.KichCo = c.KichCo
           AND v2.MauSac = c.MauSac
         ORDER BY v2.Id
         LIMIT 1
       )
       WHERE c.NguoiDungId = ?
       ORDER BY c.Id`,
      userId,
    );

    return rows.map((row) => {
      const hasVariant = row.variantId !== null && row.variantId !== undefined;
      const available = hasVariant
        ? availableStock(toNumber(row.variantStock), toNumber(row.variantReserved))
        : availableStock(toNumber(row.productStock), toNumber(row.productReserved));
      return this.mapCartItem(row, available);
    });
  }

  async addToCart(
    userId: number,
    input: { productId: number; size?: unknown; color?: unknown; quantity?: number },
  ) {
    const quantity = input.quantity ?? 1;
    if (!Number.isSafeInteger(input.productId) || input.productId <= 0) {
      throw new BadRequestException("Sản phẩm không tồn tại");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new BadRequestException("Số lượng phải lớn hơn 0");
    }

    const size = normalizeCartOption(input.size);
    const color = normalizeCartOption(input.color);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const product = await this.lockProduct(tx, input.productId);
      if (!product) throw new BadRequestException("Sản phẩm không tồn tại");
      if (product.status !== "active") {
        throw new BadRequestException("Sản phẩm hiện không thể thêm vào giỏ hàng");
      }

      const allowedSizes = parseCartOptionList(product.sizes);
      const allowedColors = parseCartOptionList(product.colors);
      if (allowedSizes.length > 0 && !containsOrdinalIgnoreCase(allowedSizes, size)) {
        throw new BadRequestException("Kích cỡ đã chọn không hợp lệ");
      }
      if (allowedColors.length > 0 && !containsOrdinalIgnoreCase(allowedColors, color)) {
        throw new BadRequestException("Màu sắc đã chọn không hợp lệ");
      }

      const allVariants = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM TonKhoBienThe WHERE SanPhamId = ? ORDER BY Id FOR UPDATE",
        input.productId,
      );
      const variant = await this.findVariant(tx, input.productId, size, color);

      if (allVariants.length > 0 && !variant) {
        throw new BadRequestException(
          "Biến thể size/màu đã chọn không tồn tại hoặc không còn bán",
        );
      }

      const productAvailable = availableStock(
        toNumber(product.stock),
        toNumber(product.reserved),
      );
      const variantAvailable = variant
        ? availableStock(toNumber(variant.stock), toNumber(variant.reserved))
        : productAvailable;
      const available = variant ? Math.min(productAvailable, variantAvailable) : productAvailable;

      if (available < quantity) {
        throw new BadRequestException(
          `Chỉ còn ${available} sản phẩm khả dụng cho size ${size} - màu ${color}`,
        );
      }

      const existing = await tx.$queryRawUnsafe<CartDbRow[]>(
        `SELECT Id AS id, SanPhamId AS productId, KichCo AS size, MauSac AS color,
                SoLuong AS quantity, GiuDenLuc AS reservedUntil
         FROM GioHang
         WHERE NguoiDungId = ? AND SanPhamId = ? AND KichCo = ? AND MauSac = ?
         ORDER BY Id
         LIMIT 1
         FOR UPDATE`,
        userId,
        input.productId,
        size,
        color,
      );

      const reservedUntil = reservationExpiresAt();
      let cartId: number;
      let finalQuantity: number;

      if (existing[0]) {
        cartId = toNumber(existing[0].id);
        finalQuantity = toNumber(existing[0].quantity) + quantity;
        await tx.$executeRawUnsafe(
          "UPDATE GioHang SET SoLuong = ?, GiuDenLuc = ? WHERE Id = ?",
          finalQuantity,
          reservedUntil,
          cartId,
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO GioHang
             (NguoiDungId, SanPhamId, KichCo, MauSac, SoLuong, GiuDenLuc)
           VALUES (?, ?, ?, ?, ?, ?)`,
          userId,
          input.productId,
          size,
          color,
          quantity,
          reservedUntil,
        );
        const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
          "SELECT LAST_INSERT_ID() AS id",
        );
        cartId = toNumber(ids[0]?.id);
        finalQuantity = quantity;
      }

      const nextProductReserved = toNumber(product.reserved) + quantity;
      await tx.$executeRawUnsafe(
        "UPDATE SanPham SET SoLuongDaGiu = ?, NgayCapNhat = ? WHERE Id = ?",
        nextProductReserved,
        new Date(),
        input.productId,
      );

      let nextVariantReserved: number | undefined;
      if (variant) {
        nextVariantReserved = toNumber(variant.reserved) + quantity;
        await tx.$executeRawUnsafe(
          "UPDATE TonKhoBienThe SET SoLuongDaGiu = ?, NgayCapNhat = ? WHERE Id = ?",
          nextVariantReserved,
          new Date(),
          toNumber(variant.id),
        );
      }

      const availableAfter = variant
        ? Math.min(
            availableStock(toNumber(product.stock), nextProductReserved),
            availableStock(toNumber(variant.stock), nextVariantReserved ?? 0),
          )
        : availableStock(toNumber(product.stock), nextProductReserved);

      return {
        id: cartId,
        productId: input.productId,
        name: product.name,
        price: toNumber(product.price),
        image: product.image,
        size,
        color,
        quantity: finalQuantity,
        availableStock: availableAfter,
        reservedUntil,
        isLowStock: availableAfter > 0 && availableAfter < 5,
      };
    });
  }

  async updateQuantity(userId: number, cartItemId: number, quantity: number) {
    if (!Number.isSafeInteger(quantity)) {
      throw new BadRequestException("Số lượng không hợp lệ");
    }
    if (quantity < 1) return null;

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const lookup = await tx.$queryRawUnsafe<Array<{ productId: unknown }>>(
        "SELECT SanPhamId AS productId FROM GioHang WHERE Id = ? AND NguoiDungId = ? LIMIT 1",
        cartItemId,
        userId,
      );
      if (!lookup[0]) return null;

      const productId = toNumber(lookup[0].productId);
      const product = await this.lockProduct(tx, productId);
      if (!product) return null;

      await tx.$queryRawUnsafe(
        "SELECT Id FROM TonKhoBienThe WHERE SanPhamId = ? ORDER BY Id FOR UPDATE",
        productId,
      );

      const items = await tx.$queryRawUnsafe<CartDbRow[]>(
        `SELECT Id AS id, SanPhamId AS productId, KichCo AS size, MauSac AS color,
                SoLuong AS quantity, GiuDenLuc AS reservedUntil
         FROM GioHang
         WHERE Id = ? AND NguoiDungId = ?
         LIMIT 1
         FOR UPDATE`,
        cartItemId,
        userId,
      );
      const item = items[0];
      if (!item) return null;

      const variant = await this.findVariant(tx, productId, item.size, item.color);
      const oldQuantity = toNumber(item.quantity);

      let update;
      try {
        update = calculateReservationUpdate({
          productStock: toNumber(product.stock),
          productReserved: toNumber(product.reserved),
          oldQuantity,
          newQuantity: quantity,
          variantStock: variant ? toNumber(variant.stock) : undefined,
          variantReserved: variant ? toNumber(variant.reserved) : undefined,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Số lượng vượt tồn kho",
        );
      }

      const now = new Date();
      const reservedUntil = reservationExpiresAt(now);

      await tx.$executeRawUnsafe(
        "UPDATE SanPham SET SoLuongDaGiu = ?, NgayCapNhat = ? WHERE Id = ?",
        update.nextProductReserved,
        now,
        productId,
      );
      if (variant && update.nextVariantReserved !== undefined) {
        await tx.$executeRawUnsafe(
          "UPDATE TonKhoBienThe SET SoLuongDaGiu = ?, NgayCapNhat = ? WHERE Id = ?",
          update.nextVariantReserved,
          now,
          toNumber(variant.id),
        );
      }
      await tx.$executeRawUnsafe(
        "UPDATE GioHang SET SoLuong = ?, GiuDenLuc = ? WHERE Id = ?",
        quantity,
        reservedUntil,
        cartItemId,
      );

      const availableAfter = variant
        ? Math.min(
            availableStock(toNumber(product.stock), update.nextProductReserved),
            availableStock(
              toNumber(variant.stock),
              update.nextVariantReserved ?? toNumber(variant.reserved),
            ),
          )
        : availableStock(toNumber(product.stock), update.nextProductReserved);

      return {
        id: cartItemId,
        productId,
        name: product.name,
        price: toNumber(product.price),
        image: product.image,
        size: item.size,
        color: item.color,
        quantity,
        availableStock: availableAfter,
        reservedUntil,
        isLowStock: availableAfter > 0 && availableAfter < 5,
      };
    });
  }

  async removeFromCart(userId: number, cartItemId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const items = await this.lockCartItems(tx, userId, [cartItemId]);
      if (items.length === 0) return false;
      await this.releaseReservations(tx, items);
      await tx.$executeRawUnsafe(
        "DELETE FROM GioHang WHERE Id = ? AND NguoiDungId = ?",
        cartItemId,
        userId,
      );
      return true;
    });
  }

  async clearCart(userId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.clearCartInTransaction(tx, userId);
    });
  }

  async clearCartInTransaction(tx: SqlClient, userId: number): Promise<number> {
    await this.lockUser(tx, userId);
    const items = await this.lockCartItems(tx, userId);
    if (items.length === 0) return 0;
    await this.releaseReservations(tx, items);
    await tx.$executeRawUnsafe("DELETE FROM GioHang WHERE NguoiDungId = ?", userId);
    return items.length;
  }

  async removeMany(userId: number, rawIds: unknown): Promise<number> {
    const ids = distinctPositiveIds(rawIds);
    if (ids.length === 0) return 0;

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const items = await this.lockCartItems(tx, userId, ids);
      if (items.length === 0) return 0;
      await this.releaseReservations(tx, items);
      await tx.$executeRawUnsafe(
        `DELETE FROM GioHang
         WHERE NguoiDungId = ? AND Id IN (${this.placeholders(items.length)})`,
        userId,
        ...items.map((item) => toNumber(item.id)),
      );
      return items.length;
    });
  }

  async moveToWishlist(userId: number, rawIds: unknown): Promise<number> {
    const ids = distinctPositiveIds(rawIds);
    if (ids.length === 0) return 0;

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const items = await this.lockCartItems(tx, userId, ids);
      if (items.length === 0) return 0;

      let moved = 0;
      const productIds = [...new Set(items.map((item) => toNumber(item.productId)))];
      for (const productId of productIds) {
        const inserted = await tx.$executeRawUnsafe(
          `INSERT IGNORE INTO DanhSachYeuThich (NguoiDungId, SanPhamId)
           VALUES (?, ?)`,
          userId,
          productId,
        );
        if (inserted > 0) moved += 1;
      }

      await this.releaseReservations(tx, items);
      await tx.$executeRawUnsafe(
        `DELETE FROM GioHang
         WHERE NguoiDungId = ? AND Id IN (${this.placeholders(items.length)})`,
        userId,
        ...items.map((item) => toNumber(item.id)),
      );
      return moved;
    });
  }

  async getCrossSell(userId: number, limit: number) {
    const source = await this.prisma.$queryRawUnsafe<Array<{ category: string }>>(
      `SELECT p.DanhMuc AS category
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       WHERE c.NguoiDungId = ?
       ORDER BY c.Id
       LIMIT 1`,
      userId,
    );
    if (!source[0]) return [];

    const safeLimit = Math.max(1, Math.min(20, limit));
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown; name: string; price: unknown; image: string;
      stock: unknown; reserved: unknown;
    }>>(
      `SELECT p.Id AS id, p.TenSanPham AS name, p.Gia AS price,
              p.HinhAnh AS image, p.TonKho AS stock,
              COALESCE(p.SoLuongDaGiu,0) AS reserved
       FROM SanPham p
       WHERE p.TrangThai = 'active'
         AND p.DanhMuc = ?
         AND NOT EXISTS (
           SELECT 1 FROM GioHang c
           WHERE c.NguoiDungId = ? AND c.SanPhamId = p.Id
         )
       ORDER BY p.SoLuongDaBan DESC
       LIMIT ${safeLimit}`,
      source[0].category,
      userId,
    );

    return rows.map((row) => {
      const available = availableStock(toNumber(row.stock), toNumber(row.reserved));
      return {
        id: 0,
        productId: toNumber(row.id),
        name: row.name,
        price: toNumber(row.price),
        image: row.image,
        size: "",
        color: "",
        quantity: 0,
        availableStock: available,
        reservedUntil: null,
        isLowStock: false,
      };
    });
  }

  async getCrossSellProducts(userId: number, limit: number) {
    const source = await this.prisma.$queryRawUnsafe<Array<{ category: string }>>(
      `SELECT p.DanhMuc AS category
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       WHERE c.NguoiDungId = ?
       ORDER BY c.Id
       LIMIT 1`,
      userId,
    );
    if (!source[0]) return [];

    const safeLimit = Math.max(1, Math.min(20, limit));
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_LIST_SELECT}
       WHERE p.TrangThai = 'active'
         AND p.DanhMuc = ?
         AND NOT EXISTS (
           SELECT 1 FROM GioHang c
           WHERE c.NguoiDungId = ? AND c.SanPhamId = p.Id
         )
       ORDER BY p.SoLuongDaBan DESC
       LIMIT ${safeLimit}`,
      source[0].category,
      userId,
    );
    return rows.map(mapProduct);
  }

  async reorder(userId: number, orderId: number) {
    const orders = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT Id AS id FROM DonHang WHERE Id = ? AND NguoiDungId = ? LIMIT 1",
      orderId,
      userId,
    );
    if (!orders[0]) throw new BadRequestException("Đơn hàng không tồn tại");

    const items = await this.prisma.$queryRawUnsafe<OrderItemRow[]>(
      `SELECT SanPhamId AS productId, TenSanPham AS productName,
              KichCo AS size, MauSac AS color, SoLuong AS quantity
       FROM ChiTietDonHang
       WHERE DonHangId = ?
       ORDER BY Id`,
      orderId,
    );

    const result = { added: 0, skipped: 0, skippedNames: [] as string[] };
    for (const item of items) {
      try {
        await this.addToCart(userId, {
          productId: toNumber(item.productId),
          size: item.size,
          color: item.color,
          quantity: toNumber(item.quantity),
        });
        result.added += 1;
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        result.skipped += 1;
        result.skippedNames.push(item.productName);
      }
    }
    return result;
  }

  async sweepExpiredReservations(now = new Date()): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.$queryRawUnsafe<Array<{ productId: unknown }>>(
        `SELECT DISTINCT SanPhamId AS productId
         FROM GioHang
         WHERE GiuDenLuc IS NOT NULL AND GiuDenLuc < ?`,
        now,
      );
      const productIds = initial.map((row) => toNumber(row.productId));
      if (productIds.length === 0) return 0;

      await this.lockProducts(tx, productIds);
      await this.lockVariantsForProducts(tx, productIds);

      const items = await tx.$queryRawUnsafe<CartDbRow[]>(
        `SELECT Id AS id, SanPhamId AS productId, KichCo AS size, MauSac AS color,
                SoLuong AS quantity, GiuDenLuc AS reservedUntil
         FROM GioHang
         WHERE GiuDenLuc IS NOT NULL
           AND GiuDenLuc < ?
           AND SanPhamId IN (${this.placeholders(productIds.length)})
         ORDER BY Id
         FOR UPDATE`,
        now,
        ...productIds,
      );
      if (items.length === 0) return 0;

      await this.releaseReservations(tx, items);
      await tx.$executeRawUnsafe(
        `DELETE FROM GioHang
         WHERE Id IN (${this.placeholders(items.length)})`,
        ...items.map((item) => toNumber(item.id)),
      );
      return items.length;
    });
  }

  private async lockUser(tx: SqlClient, userId: number): Promise<void> {
    await tx.$queryRawUnsafe(
      "SELECT Id FROM NguoiDung WHERE Id = ? FOR UPDATE",
      userId,
    );
  }

  private async lockProduct(
    tx: SqlClient,
    productId: number,
  ): Promise<CartProductRow | null> {
    const rows = await tx.$queryRawUnsafe<CartProductRow[]>(
      `SELECT Id AS id, TenSanPham AS name, DanhMuc AS category,
              Gia AS price, HinhAnh AS image, TonKho AS stock,
              COALESCE(SoLuongDaGiu,0) AS reserved, TrangThai AS status,
              DanhSachMau AS colors, DanhSachSize AS sizes
       FROM SanPham
       WHERE Id = ?
       LIMIT 1
       FOR UPDATE`,
      productId,
    );
    return rows[0] ?? null;
  }

  private async findVariant(
    tx: SqlClient,
    productId: number,
    size: string,
    color: string,
  ): Promise<VariantRow | null> {
    const rows = await tx.$queryRawUnsafe<VariantRow[]>(
      `SELECT Id AS id, SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
              KichCo AS size, MauSac AS color
       FROM TonKhoBienThe
       WHERE SanPhamId = ? AND KichCo = ? AND MauSac = ?
       ORDER BY Id
       LIMIT 1`,
      productId,
      size,
      color,
    );
    return rows[0] ?? null;
  }

  private async lockCartItems(
    tx: SqlClient,
    userId: number,
    selectedIds?: number[],
  ): Promise<CartDbRow[]> {
    const filter = selectedIds && selectedIds.length > 0
      ? ` AND Id IN (${this.placeholders(selectedIds.length)})`
      : "";
    const params: unknown[] = [userId, ...(selectedIds ?? [])];

    const initial = await tx.$queryRawUnsafe<CartDbRow[]>(
      `SELECT Id AS id, SanPhamId AS productId, KichCo AS size, MauSac AS color,
              SoLuong AS quantity, GiuDenLuc AS reservedUntil
       FROM GioHang
       WHERE NguoiDungId = ?${filter}
       ORDER BY Id`,
      ...params,
    );
    if (initial.length === 0) return [];

    const productIds = [...new Set(initial.map((item) => toNumber(item.productId)))];
    await this.lockProducts(tx, productIds);
    await this.lockVariantsForProducts(tx, productIds);

    return tx.$queryRawUnsafe<CartDbRow[]>(
      `SELECT Id AS id, SanPhamId AS productId, KichCo AS size, MauSac AS color,
              SoLuong AS quantity, GiuDenLuc AS reservedUntil
       FROM GioHang
       WHERE NguoiDungId = ?${filter}
       ORDER BY Id
       FOR UPDATE`,
      ...params,
    );
  }

  private async lockProducts(tx: SqlClient, productIds: number[]): Promise<void> {
    const ids = [...new Set(productIds)].sort((a, b) => a - b);
    if (ids.length === 0) return;
    await tx.$queryRawUnsafe(
      `SELECT Id FROM SanPham
       WHERE Id IN (${this.placeholders(ids.length)})
       ORDER BY Id
       FOR UPDATE`,
      ...ids,
    );
  }

  private async lockVariantsForProducts(
    tx: SqlClient,
    productIds: number[],
  ): Promise<void> {
    const ids = [...new Set(productIds)].sort((a, b) => a - b);
    if (ids.length === 0) return;
    await tx.$queryRawUnsafe(
      `SELECT Id FROM TonKhoBienThe
       WHERE SanPhamId IN (${this.placeholders(ids.length)})
       ORDER BY SanPhamId, Id
       FOR UPDATE`,
      ...ids,
    );
  }

  private async releaseReservations(
    tx: SqlClient,
    cartRows: CartDbRow[],
  ): Promise<void> {
    const releaseItems: ReservationReleaseItem[] = cartRows.map((row) => ({
      productId: toNumber(row.productId),
      size: row.size,
      color: row.color,
      quantity: toNumber(row.quantity),
    }));
    const grouped = groupReservationRelease(releaseItems);
    const now = new Date();

    for (const product of grouped.products) {
      await tx.$executeRawUnsafe(
        `UPDATE SanPham
         SET SoLuongDaGiu = GREATEST(0, COALESCE(SoLuongDaGiu,0) - ?),
             NgayCapNhat = ?
         WHERE Id = ?`,
        product.quantity,
        now,
        product.productId,
      );
    }

    for (const variant of grouped.variants) {
      const matches = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM TonKhoBienThe
         WHERE SanPhamId = ? AND KichCo = ? AND MauSac = ?
         ORDER BY Id
         LIMIT 1`,
        variant.productId,
        variant.size,
        variant.color,
      );
      if (!matches[0]) continue;

      await tx.$executeRawUnsafe(
        `UPDATE TonKhoBienThe
         SET SoLuongDaGiu = GREATEST(0, COALESCE(SoLuongDaGiu,0) - ?),
             NgayCapNhat = ?
         WHERE Id = ?`,
        variant.quantity,
        now,
        toNumber(matches[0].id),
      );
    }
  }

  private mapCartItem(row: CartViewRow, available: number) {
    return {
      id: toNumber(row.id),
      productId: toNumber(row.productId),
      name: row.name,
      price: toNumber(row.price),
      image: row.image,
      size: row.size,
      color: row.color,
      quantity: toNumber(row.quantity),
      availableStock: available,
      reservedUntil: row.reservedUntil,
      isLowStock: available > 0 && available < 5,
    };
  }

  private placeholders(count: number): string {
    return Array.from({ length: count }, () => "?").join(",");
  }
}
