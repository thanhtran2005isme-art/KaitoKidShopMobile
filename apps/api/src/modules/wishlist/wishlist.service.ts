import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNullableNumber, toNumber } from "../../common/db-value.js";

interface WishlistRow {
  id: unknown;
  productId: unknown;
  productName: string;
  price: unknown;
  oldPrice: unknown;
  image: string;
  createdAt: Date | string;
}

function mapWishlist(row: WishlistRow) {
  return {
    id: toNumber(row.id),
    productId: toNumber(row.productId),
    productName: row.productName,
    price: toNumber(row.price),
    oldPrice: toNullableNumber(row.oldPrice),
    image: row.image,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<WishlistRow[]>(
      `SELECT
         w.Id AS id, w.SanPhamId AS productId, p.TenSanPham AS productName,
         p.Gia AS price, p.GiaCu AS oldPrice, p.HinhAnh AS image, w.NgayTao AS createdAt
       FROM DanhSachYeuThich w
       JOIN SanPham p ON p.Id = w.SanPhamId
       WHERE w.NguoiDungId = ?
       ORDER BY w.NgayTao DESC`,
      userId,
    );
    return rows.map(mapWishlist);
  }

  async add(userId: number, productId: number) {
    const exists = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT Id AS id FROM DanhSachYeuThich WHERE NguoiDungId = ? AND SanPhamId = ? LIMIT 1",
      userId,
      productId,
    );
    if (exists.length > 0) return null;

    const products = await this.prisma.$queryRawUnsafe<Array<{
      name: string; price: unknown; oldPrice: unknown; image: string;
    }>>(
      "SELECT TenSanPham AS name, Gia AS price, GiaCu AS oldPrice, HinhAnh AS image FROM SanPham WHERE Id = ? LIMIT 1",
      productId,
    );
    if (!products[0]) return null;

    try {
      await this.prisma.$executeRawUnsafe(
        "INSERT INTO DanhSachYeuThich (NguoiDungId, SanPhamId) VALUES (?, ?)",
        userId,
        productId,
      );
    } catch (error) {
      const raced = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM DanhSachYeuThich WHERE NguoiDungId = ? AND SanPhamId = ? LIMIT 1",
        userId,
        productId,
      );
      if (raced.length > 0) return null;
      throw error;
    }

    const rows = await this.prisma.$queryRawUnsafe<WishlistRow[]>(
      `SELECT
         w.Id AS id, w.SanPhamId AS productId, p.TenSanPham AS productName,
         p.Gia AS price, p.GiaCu AS oldPrice, p.HinhAnh AS image, w.NgayTao AS createdAt
       FROM DanhSachYeuThich w
       JOIN SanPham p ON p.Id = w.SanPhamId
       WHERE w.NguoiDungId = ? AND w.SanPhamId = ?
       LIMIT 1`,
      userId,
      productId,
    );
    return rows[0] ? mapWishlist(rows[0]) : null;
  }

  async remove(userId: number, productId: number): Promise<boolean> {
    const affected = await this.prisma.$executeRawUnsafe(
      "DELETE FROM DanhSachYeuThich WHERE NguoiDungId = ? AND SanPhamId = ?",
      userId,
      productId,
    );
    return affected > 0;
  }
}
