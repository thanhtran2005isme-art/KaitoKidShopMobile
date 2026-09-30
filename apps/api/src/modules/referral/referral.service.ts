import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface ReferralUserRow {
  id: unknown;
  referralCode: string | null;
}

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  async myCode(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRawUnsafe<ReferralUserRow[]>(
        "SELECT Id AS id, MaGioiThieu AS referralCode FROM NguoiDung WHERE Id = ? FOR UPDATE",
        userId,
      );
      const user = users[0];
      if (!user) return null;

      let code = user.referralCode;
      if (!code) {
        code = await this.uniqueReferralCode(tx, userId);
        await tx.$executeRawUnsafe(
          "UPDATE NguoiDung SET MaGioiThieu = ? WHERE Id = ?",
          code,
          userId,
        );
      }
      return { code };
    });
  }

  async claim(userId: number, rawCode: unknown) {
    if (typeof rawCode !== "string" || !rawCode.trim()) {
      throw new BadRequestException("Vui lòng nhập mã giới thiệu.");
    }
    const code = rawCode.trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM NguoiDung WHERE Id = ? FOR UPDATE",
        userId,
      );
      if (!current[0]) return null;

      const referrers = await tx.$queryRawUnsafe<ReferralUserRow[]>(
        "SELECT Id AS id, MaGioiThieu AS referralCode FROM NguoiDung WHERE MaGioiThieu = ? LIMIT 1",
        code,
      );
      const referrer = referrers[0];
      if (!referrer) throw new BadRequestException("Mã giới thiệu không hợp lệ.");

      const referrerId = toNumber(referrer.id);
      if (referrerId === userId) {
        throw new BadRequestException("Không thể tự giới thiệu chính mình.");
      }

      const used = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM GioiThieu WHERE NguoiMoiId = ? LIMIT 1",
        userId,
      );
      if (used.length > 0) {
        throw new BadRequestException("Bạn đã sử dụng mã giới thiệu trước đó.");
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const stamp = this.yyMMddHHmmss(now);
      const newCode = await this.uniqueCouponCode(tx, () => `RF-${userId}-${stamp}`);
      const refCode = await this.uniqueCouponCode(
        tx,
        () => `RF-${referrerId}-${stamp}-R${randomInt(10, 100)}`,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO MaGiamGia
           (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, DaSuDung,
            NgayBatDau, NgayKetThuc, TrangThai)
         VALUES (?, 'fixed', 50000, 200000, NULL, 1, 0, ?, ?, 1)`,
        newCode,
        now,
        endDate,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO MaGiamGia
           (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, DaSuDung,
            NgayBatDau, NgayKetThuc, TrangThai)
         VALUES (?, 'fixed', 100000, 300000, NULL, 1, 0, ?, ?, 1)`,
        refCode,
        now,
        endDate,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO GioiThieu
           (NguoiMoiId, NguoiGioiThieuId, MaCouponMoi, MaCouponGT, TrangThai, NgayThuong)
         VALUES (?, ?, ?, ?, 'rewarded', ?)`,
        userId,
        referrerId,
        newCode,
        refCode,
        now,
      );

      return {
        message: "Đã ghi nhận. Bạn nhận voucher giảm 50K, người giới thiệu nhận 100K.",
        yourCoupon: newCode,
      };
    });
  }

  private async uniqueReferralCode(tx: any, userId: number): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const seed = (Math.imul(userId, 1315423911) ^ randomInt(0, 0x7fffffff)) & 0x7fffffff;
      const hex = seed.toString(16).toUpperCase().padStart(6, "0");
      const code = `KK${userId}${hex.slice(0, 4)}`;
      const exists = await tx.$queryRawUnsafe(
        "SELECT Id FROM NguoiDung WHERE MaGioiThieu = ? LIMIT 1",
        code,
      );
      if (!Array.isArray(exists) || exists.length === 0) return code;
    }
    throw new Error("Không thể sinh mã giới thiệu duy nhất.");
  }

  private async uniqueCouponCode(tx: any, makeCode: () => string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = makeCode();
      const exists = await tx.$queryRawUnsafe(
        "SELECT Id FROM MaGiamGia WHERE MaCoupon = ? LIMIT 1",
        code,
      );
      if (!Array.isArray(exists) || exists.length === 0) return code;
    }
    throw new Error("Không thể sinh mã voucher giới thiệu duy nhất.");
  }

  private yyMMddHHmmss(date: Date): string {
    return [
      String(date.getUTCFullYear()).slice(-2),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
      String(date.getUTCHours()).padStart(2, "0"),
      String(date.getUTCMinutes()).padStart(2, "0"),
      String(date.getUTCSeconds()).padStart(2, "0"),
    ].join("");
  }
}
