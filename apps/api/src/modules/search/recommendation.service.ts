import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import { PRODUCT_SELECT } from "./search.service.js";

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async forMe(userId: number | null, rawLimit = 12) {
    const limit = Math.max(1, Math.min(24, rawLimit));
    let signalCategories: string[] = [];
    let purchasedIds: number[] = [];

    if (userId) {
      const wishlist = await this.prisma.$queryRawUnsafe<Array<{ category: string }>>(
        `SELECT DISTINCT p.DanhMuc AS category
         FROM DanhSachYeuThich w
         JOIN SanPham p ON p.Id=w.SanPhamId
         WHERE w.NguoiDungId=? AND p.TrangThai='active'`,
        userId,
      );
      const purchased = await this.prisma.$queryRawUnsafe<Array<{ productId: unknown }>>(
        `SELECT DISTINCT i.SanPhamId AS productId
         FROM DonHang o
         JOIN ChiTietDonHang i ON i.DonHangId=o.Id
         WHERE o.NguoiDungId=? AND o.TrangThai='completed'`,
        userId,
      );
      purchasedIds = purchased.map((x) => Number(x.productId)).filter(Number.isSafeInteger);
      let orderCategories: Array<{ category: string }> = [];
      if (purchasedIds.length) {
        orderCategories = await this.prisma.$queryRawUnsafe<
          Array<{ category: string }>
        >(
          `SELECT DISTINCT DanhMuc AS category
           FROM SanPham
           WHERE Id IN (${purchasedIds.map(() => "?").join(",")})`,
          ...purchasedIds,
        );
      }
      signalCategories = [
        ...new Set(
          [...wishlist, ...orderCategories]
            .map((x) => x.category)
            .filter(Boolean),
        ),
      ];
    }

    const result: ReturnType<typeof mapProduct>[] = [];
    const selected = new Set<number>();

    const add = async (where: string, params: unknown[], order: string) => {
      if (result.length >= limit) return;
      const excluded = [...selected, ...purchasedIds];
      const excludedSql = excluded.length
        ? `AND Id NOT IN (${excluded.map(() => "?").join(",")})`
        : "";
      const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
        `${PRODUCT_SELECT}
         WHERE TrangThai='active'
           ${where}
           ${excludedSql}
         ORDER BY ${order}
         LIMIT ${limit - result.length}`,
        ...params,
        ...excluded,
      );
      for (const row of rows) {
        const product = mapProduct(row);
        if (selected.add(product.id)) result.push(product);
      }
    };

    let personalizedCount = 0;
    if (signalCategories.length) {
      await add(
        `AND DanhMuc IN (${signalCategories.map(() => "?").join(",")})`,
        signalCategories,
        "BanChayNhat DESC, SoLuongDaBan DESC, DiemDanhGia DESC, LaSanPhamMoi DESC, Id DESC",
      );
      personalizedCount = result.length;
    }

    await add(
      "AND BanChayNhat=1",
      [],
      "SoLuongDaBan DESC, DiemDanhGia DESC, Id DESC",
    );
    await add(
      "AND LaSanPhamMoi=1",
      [],
      "NgayTao DESC, Id DESC",
    );
    await add(
      "",
      [],
      "SoLuongDaBan DESC, DiemDanhGia DESC, Id DESC",
    );

    return {
      isPersonalized: personalizedCount > 0,
      source: personalizedCount > 0 ? "wishlist-orders" : "fallback",
      items: result,
    };
  }
}
