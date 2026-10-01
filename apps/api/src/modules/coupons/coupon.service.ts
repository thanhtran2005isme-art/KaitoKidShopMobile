import { Injectable } from "@nestjs/common";
import { toBoolean, toNullableNumber, toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  evaluateCoupon,
  type CouponSnapshot,
} from "./coupon.helpers.js";

interface CouponRow {
  type: string;
  value: unknown;
  minOrderAmount: unknown;
  maxDiscount: unknown;
  usageLimit: unknown;
  usedCount: unknown;
  startDate: Date | string;
  endDate: Date | string;
  isActive: unknown;
}

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  validate(code: string, orderAmount: number) {
    return this.validateWithClient(
      this.prisma,
      code,
      orderAmount,
      false,
    );
  }

  async validateWithClient(
    client: SqlClient,
    code: string,
    orderAmount: number,
    forUpdate: boolean,
  ) {
    const rows = await client.$queryRawUnsafe<CouponRow[]>(
      `SELECT
         LoaiGiamGia AS type,
         GiaTri AS value,
         DonToiThieu AS minOrderAmount,
         GiamToiDa AS maxDiscount,
         SoLuotDung AS usageLimit,
         DaSuDung AS usedCount,
         NgayBatDau AS startDate,
         NgayKetThuc AS endDate,
         TrangThai AS isActive
       FROM MaGiamGia
       WHERE MaCoupon = ?
       LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
      code,
    );

    const row = rows[0];
    const coupon: CouponSnapshot | null = row
      ? {
          type: row.type,
          value: toNumber(row.value),
          minOrderAmount: toNullableNumber(row.minOrderAmount),
          maxDiscount: toNullableNumber(row.maxDiscount),
          usageLimit: toNumber(row.usageLimit),
          usedCount: toNumber(row.usedCount),
          startDate: new Date(row.startDate),
          endDate: new Date(row.endDate),
          isActive: toBoolean(row.isActive),
        }
      : null;

    return evaluateCoupon(coupon, orderAmount);
  }

  async incrementUsageWithClient(
    client: SqlClient,
    code: string,
  ): Promise<void> {
    await client.$executeRawUnsafe(
      "UPDATE MaGiamGia SET DaSuDung = DaSuDung + 1 WHERE MaCoupon = ?",
      code,
    );
  }

  async restoreUsageWithClient(
    client: SqlClient,
    code: string | null,
  ): Promise<void> {
    if (!code) return;
    await client.$executeRawUnsafe(
      `UPDATE MaGiamGia
       SET DaSuDung = GREATEST(0, DaSuDung - 1)
       WHERE MaCoupon = ?`,
      code,
    );
  }
}
