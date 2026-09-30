import { Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";

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
    const items = await tx.$queryRawUnsafe<ItemRow[]>(
      `SELECT SanPhamId AS productId, KichCo AS size,
              MauSac AS color, SoLuong AS quantity
       FROM ChiTietDonHang
       WHERE DonHangId = ?
       ORDER BY Id`,
      orderId,
    );
    if (items.length === 0) return;

    const productIds = [...new Set(items.map((item) => toNumber(item.productId)))]
      .sort((a, b) => a - b);
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
}
