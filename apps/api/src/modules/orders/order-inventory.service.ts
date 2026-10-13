import { Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { reservationExpiresAt } from "../cart/cart.helpers.js";

interface ItemRow {
  productId: unknown;
  size: string;
  color: string;
  quantity: unknown;
}

@Injectable()
export class OrderInventoryService {
  async restoreStockInTransaction(
    tx: SqlClient,
    orderId: number,
  ): Promise<void> {
    const items = await this.loadOrderItems(tx, orderId);
    if (items.length === 0) return;

    const productIds = this.productIds(items);
    await this.lockInventory(tx, productIds);

    const now = new Date();
    for (const item of items) {
      const productId = toNumber(item.productId);
      const quantity = toNumber(item.quantity);

      await tx.$executeRawUnsafe(
        `UPDATE SanPham
         SET TrangThai = CASE
               WHEN TonKho + ? > 0 AND TrangThai = 'out-of-stock'
                 THEN 'active'
               ELSE TrangThai
             END,
             TonKho = TonKho + ?,
             SoLuongDaBan = GREATEST(0, SoLuongDaBan - ?)
         WHERE Id = ?`,
        quantity,
        quantity,
        quantity,
        productId,
      );

      const variants = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM TonKhoBienThe
         WHERE SanPhamId = ? AND KichCo = ? AND MauSac = ?
         ORDER BY Id
         LIMIT 1`,
        productId,
        item.size,
        item.color,
      );
      if (variants[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE TonKhoBienThe
           SET SoLuong = SoLuong + ?,
               SoLuongDaBan = GREATEST(0, SoLuongDaBan - ?),
               NgayCapNhat = ?
           WHERE Id = ?`,
          quantity,
          quantity,
          now,
          toNumber(variants[0].id),
        );
      }
    }
  }

  /**
   * Hoàn tác một pending order về đúng trạng thái giỏ hàng trước checkout.
   *
   * Order creation đã chuyển reservation thành stock sold và xóa selected cart
   * rows. Khi online payment bị hủy/hết hạn, chỉ restore stock là chưa đủ: khách
   * sẽ thấy sản phẩm biến mất khỏi giỏ. Phương thức này khóa user trước inventory
   * theo cùng lock order với CartService, restore stock rồi reserve lại chính
   * variant đó trong GioHang trong cùng transaction.
   */
  async restoreStockAndCartInTransaction(
    tx: SqlClient,
    orderId: number,
    userId: number,
  ): Promise<void> {
    await tx.$queryRawUnsafe(
      "SELECT Id FROM NguoiDung WHERE Id = ? LIMIT 1 FOR UPDATE",
      userId,
    );

    const items = await this.loadOrderItems(tx, orderId);
    if (items.length === 0) return;

    // Sau khi user lock đã giữ, reuse stock restore để giữ lock order
    // user -> product -> variant, đồng nhất với CartService.
    await this.restoreStockInTransaction(tx, orderId);

    const reservedUntil = reservationExpiresAt();
    const now = new Date();
    for (const item of items) {
      const productId = toNumber(item.productId);
      const quantity = toNumber(item.quantity);
      if (quantity <= 0) continue;

      const existing = await tx.$queryRawUnsafe<Array<{
        id: unknown;
        quantity: unknown;
      }>>(
        `SELECT Id AS id, SoLuong AS quantity
         FROM GioHang
         WHERE NguoiDungId = ? AND SanPhamId = ?
           AND KichCo = ? AND MauSac = ?
         ORDER BY Id
         LIMIT 1
         FOR UPDATE`,
        userId,
        productId,
        item.size,
        item.color,
      );

      if (existing[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE GioHang
           SET SoLuong = ?, GiuDenLuc = ?
           WHERE Id = ?`,
          toNumber(existing[0].quantity) + quantity,
          reservedUntil,
          toNumber(existing[0].id),
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO GioHang
             (NguoiDungId, SanPhamId, KichCo, MauSac, SoLuong, GiuDenLuc)
           VALUES (?, ?, ?, ?, ?, ?)`,
          userId,
          productId,
          item.size,
          item.color,
          quantity,
          reservedUntil,
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE SanPham
         SET SoLuongDaGiu = COALESCE(SoLuongDaGiu, 0) + ?,
             NgayCapNhat = ?
         WHERE Id = ?`,
        quantity,
        now,
        productId,
      );

      const variants = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM TonKhoBienThe
         WHERE SanPhamId = ? AND KichCo = ? AND MauSac = ?
         ORDER BY Id
         LIMIT 1`,
        productId,
        item.size,
        item.color,
      );
      if (variants[0]) {
        await tx.$executeRawUnsafe(
          `UPDATE TonKhoBienThe
           SET SoLuongDaGiu = COALESCE(SoLuongDaGiu, 0) + ?,
               NgayCapNhat = ?
           WHERE Id = ?`,
          quantity,
          now,
          toNumber(variants[0].id),
        );
      }
    }
  }

  private loadOrderItems(tx: SqlClient, orderId: number): Promise<ItemRow[]> {
    return tx.$queryRawUnsafe<ItemRow[]>(
      `SELECT SanPhamId AS productId, KichCo AS size,
              MauSac AS color, SoLuong AS quantity
       FROM ChiTietDonHang
       WHERE DonHangId = ?
       ORDER BY Id`,
      orderId,
    );
  }

  private productIds(items: ItemRow[]): number[] {
    return [...new Set(items.map((item) => toNumber(item.productId)))]
      .sort((a, b) => a - b);
  }

  private async lockInventory(tx: SqlClient, productIds: number[]): Promise<void> {
    if (productIds.length === 0) return;
    const marks = productIds.map(() => "?").join(",");
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
}
