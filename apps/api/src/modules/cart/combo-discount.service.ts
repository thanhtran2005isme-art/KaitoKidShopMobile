import { BadRequestException, Injectable } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  evaluateComboRows,
  type ComboRow,
} from "./combo-discount.helpers.js";
import { distinctPositiveIds } from "./cart.helpers.js";

interface ComboDbRow {
  productId: unknown;
  category: string;
  price: unknown;
  quantity: unknown;
}

@Injectable()
export class ComboDiscountService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<ComboDbRow[]>(
      `SELECT c.SanPhamId AS productId, p.DanhMuc AS category,
              p.Gia AS price, c.SoLuong AS quantity
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       WHERE c.NguoiDungId = ?`,
      userId,
    );
    return evaluateComboRows(this.toComboRows(rows));
  }

  async evaluateSelected(userId: number, rawIds: unknown) {
    const ids = distinctPositiveIds(rawIds);
    if (ids.length === 0) {
      return evaluateComboRows([]);
    }

    const rows = await this.prisma.$queryRawUnsafe<ComboDbRow[]>(
      `SELECT c.SanPhamId AS productId, p.DanhMuc AS category,
              p.Gia AS price, c.SoLuong AS quantity
       FROM GioHang c
       JOIN SanPham p ON p.Id = c.SanPhamId
       WHERE c.NguoiDungId = ?
         AND c.Id IN (${Array.from({ length: ids.length }, () => "?").join(",")})`,
      userId,
      ...ids,
    );

    if (rows.length !== ids.length) {
      throw new BadRequestException(
        "Danh sách sản phẩm checkout không hợp lệ hoặc đã thay đổi.",
      );
    }
    return evaluateComboRows(this.toComboRows(rows));
  }

  private toComboRows(rows: ComboDbRow[]): ComboRow[] {
    return rows.map((row) => ({
      productId: toNumber(row.productId),
      category: row.category,
      price: toNumber(row.price),
      quantity: toNumber(row.quantity),
    }));
  }
}
