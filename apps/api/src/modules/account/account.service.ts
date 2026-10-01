import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../../database/prisma.service.js";
import { CartService } from "../cart/cart.service.js";
import { toNumber, toNullableNumber } from "../../common/db-value.js";
import { normalizePhone, resolveNextTier, utcDateOnly } from "./account.helpers.js";

interface ProfileRow {
  id: unknown;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  createdAt: Date | string;
  loyaltyPoints: unknown;
  memberTier: string;
  totalSpent: unknown;
  birthday: Date | string | null;
}

interface RewardUserRow {
  id: unknown;
  loyaltyPoints: unknown;
  memberTier: string;
  birthday: Date | string | null;
  birthdayMonth: unknown;
}

interface UpdateProfileInput {
  name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  birthday?: string | Date | null;
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
  ) {}

  async getProfile(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<ProfileRow[]>(
      `SELECT
         Id AS id, HoTen AS name, Email AS email, SoDienThoai AS phone,
         AnhDaiDien AS avatar, NgayTao AS createdAt,
         COALESCE(DiemThuong, 0) AS loyaltyPoints,
         COALESCE(CapBac, 'Member') AS memberTier,
         COALESCE(TongChiTieu, 0) AS totalSpent,
         NgaySinh AS birthday
       FROM NguoiDung
       WHERE Id = ?
       LIMIT 1`,
      userId,
    );
    if (!rows[0]) return null;

    const totalRows = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      "SELECT COUNT(*) AS total FROM DonHang WHERE NguoiDungId = ?",
      userId,
    );

    const row = rows[0];
    const totalSpent = toNumber(row.totalSpent);
    const tier = resolveNextTier(row.memberTier);

    return {
      id: toNumber(row.id),
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar,
      createdAt: row.createdAt,
      loyaltyPoints: toNumber(row.loyaltyPoints),
      memberTier: row.memberTier,
      totalSpent,
      birthday: row.birthday,
      nextTier: tier.nextTier,
      nextTierAt: tier.threshold,
      amountToNextTier: Math.max(0, tier.threshold - totalSpent),
      totalOrders: toNumber(totalRows[0]?.total),
    };
  }

  async updateProfile(userId: number, input: UpdateProfileInput) {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined && input.name !== null) {
      const name = input.name.trim();
      if (name.length < 2) throw new BadRequestException("Họ tên phải có ít nhất 2 ký tự.");
      sets.push("HoTen = ?");
      params.push(name);
    }

    if (input.phone !== undefined && input.phone !== null) {
      try {
        const phone = normalizePhone(input.phone);
        sets.push("SoDienThoai = ?");
        params.push(phone);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Số điện thoại không hợp lệ.");
      }
    }

    if (input.avatar !== undefined && input.avatar !== null) {
      const avatar = input.avatar.trim();
      if (avatar && !avatar.toLowerCase().startsWith("/uploads/avatars/")) {
        throw new BadRequestException("Ảnh đại diện phải được tải lên qua endpoint avatar.");
      }
      sets.push("AnhDaiDien = ?");
      params.push(avatar || null);
    }

    if (input.birthday !== undefined && input.birthday !== null) {
      try {
        sets.push("NgaySinh = ?");
        params.push(utcDateOnly(input.birthday));
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Ngày sinh không hợp lệ.");
      }
    }

    if (!(await this.userExists(userId))) return null;

    if (sets.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE NguoiDung SET ${sets.join(", ")} WHERE Id = ?`,
        ...params,
        userId,
      );
    }

    return this.getProfile(userId);
  }

  async setAvatar(userId: number, url: string): Promise<{ oldAvatar: string | null } | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ avatar: string | null }>>(
      "SELECT AnhDaiDien AS avatar FROM NguoiDung WHERE Id = ? LIMIT 1",
      userId,
    );
    if (!rows[0]) return null;

    await this.prisma.$executeRawUnsafe(
      "UPDATE NguoiDung SET AnhDaiDien = ? WHERE Id = ?",
      url,
      userId,
    );
    return { oldAvatar: rows[0].avatar };
  }

  async getPointsHistory(userId: number, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         p.Id AS id,
         p.LoaiGiaoDich AS type,
         p.SoDiem AS points,
         p.SoDuSauGiaoDich AS balanceAfter,
         p.DonHangId AS orderId,
         o.MaDonHang AS orderCode,
         p.MoTa AS description,
         p.NgayTao AS createdAt
       FROM LichSuDiem p
       LEFT JOIN DonHang o ON o.Id = p.DonHangId
       WHERE p.NguoiDungId = ?
       ORDER BY p.NgayTao DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      userId,
    );

    return rows.map((row) => ({
      id: toNumber(row.id),
      type: row.type,
      points: toNumber(row.points),
      balanceAfter: toNumber(row.balanceAfter),
      orderId: row.orderId === null ? null : toNumber(row.orderId),
      orderCode: row.orderCode,
      description: row.description,
      createdAt: row.createdAt,
    }));
  }

  async redeemPoints(userId: number, points: number) {
    if (!Number.isInteger(points) || points <= 0 || points % 100 !== 0) {
      throw new BadRequestException("Số điểm phải là bội số của 100.");
    }

    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRawUnsafe<RewardUserRow[]>(
        `SELECT Id AS id, COALESCE(DiemThuong,0) AS loyaltyPoints,
                COALESCE(CapBac,'Member') AS memberTier, NgaySinh AS birthday,
                MONTH(NgaySinh) AS birthdayMonth
         FROM NguoiDung WHERE Id = ? FOR UPDATE`,
        userId,
      );
      const user = users[0];
      if (!user) return null;

      const balance = toNumber(user.loyaltyPoints);
      if (balance < points) throw new BadRequestException("Không đủ điểm thưởng để đổi.");

      const discountValue = (points / 100) * 10_000;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const couponCode = await this.uniqueCouponCode(
        tx,
        () => `PT${userId}-${this.yyMMdd(now)}-${randomInt(1000, 10000)}`,
      );
      const remaining = balance - points;

      await tx.$executeRawUnsafe(
        `INSERT INTO MaGiamGia
           (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, DaSuDung,
            NgayBatDau, NgayKetThuc, TrangThai)
         VALUES (?, 'fixed', ?, ?, NULL, 1, 0, ?, ?, 1)`,
        couponCode,
        discountValue,
        discountValue * 2,
        now,
        expiresAt,
      );
      await tx.$executeRawUnsafe(
        "UPDATE NguoiDung SET DiemThuong = ? WHERE Id = ?",
        remaining,
        userId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO LichSuDiem
           (NguoiDungId, LoaiGiaoDich, SoDiem, SoDuSauGiaoDich, DonHangId, MoTa)
         VALUES (?, 'redeem', ?, ?, NULL, ?)`,
        userId,
        -points,
        remaining,
        `Đổi ${points} điểm lấy voucher giảm ${discountValue.toLocaleString("vi-VN")}đ — mã ${couponCode}`,
      );

      return {
        couponCode,
        discountValue,
        remainingPoints: remaining,
        expiresAt,
      };
    });
  }

  async getMyVouchers(userId: number) {
    if (!(await this.userExists(userId))) return null;
    const now = new Date();
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         MaCoupon AS code, LoaiGiamGia AS type, GiaTri AS value,
         DonToiThieu AS minOrderAmount, NgayBatDau AS startDate,
         NgayKetThuc AS endDate, TrangThai AS isActive
       FROM MaGiamGia
       WHERE (MaCoupon LIKE ? OR MaCoupon LIKE ?)
         AND TrangThai = 1
         AND NgayKetThuc >= ?
         AND DaSuDung < SoLuotDung
       ORDER BY NgayBatDau DESC`,
      `PT${userId}-%`,
      `BD${userId}-%`,
      now,
    );

    return rows.map((row) => {
      const value = toNumber(row.value);
      const minOrder = toNullableNumber(row.minOrderAmount) ?? 0;
      const type = String(row.type);
      return {
        code: row.code,
        type,
        value,
        minOrderAmount: minOrder,
        startDate: row.startDate,
        endDate: row.endDate,
        isActive: Boolean(toNumber(row.isActive)),
        description: type === "percent"
          ? `Voucher sinh nhật — giảm ${value.toLocaleString("vi-VN")}% cho đơn từ ${minOrder.toLocaleString("vi-VN")}đ`
          : `Voucher cá nhân — giảm ${value.toLocaleString("vi-VN")}đ cho đơn từ ${minOrder.toLocaleString("vi-VN")}đ`,
      };
    });
  }

  async claimBirthdayVoucher(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRawUnsafe<RewardUserRow[]>(
        `SELECT Id AS id, COALESCE(DiemThuong,0) AS loyaltyPoints,
                COALESCE(CapBac,'Member') AS memberTier, NgaySinh AS birthday,
                MONTH(NgaySinh) AS birthdayMonth
         FROM NguoiDung WHERE Id = ? FOR UPDATE`,
        userId,
      );
      const user = users[0];
      if (!user) return null;
      if (!user.birthday) throw new BadRequestException("Vui lòng cập nhật ngày sinh trước.");

      const now = new Date();
      if (toNumber(user.birthdayMonth) !== now.getUTCMonth() + 1) {
        throw new BadRequestException("Voucher sinh nhật chỉ phát trong đúng tháng sinh của bạn.");
      }

      const prefix = `BD${userId}-${now.getUTCFullYear()}-`;
      const existed = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM MaGiamGia WHERE MaCoupon LIKE ? LIMIT 1",
        `${prefix}%`,
      );
      if (existed.length > 0) {
        throw new BadRequestException("Bạn đã nhận voucher sinh nhật năm nay rồi.");
      }

      const tiers: Record<string, [number, number]> = {
        Diamond: [20, 500_000],
        Gold: [15, 400_000],
        Silver: [10, 300_000],
        Member: [5, 200_000],
      };
      const [percent, minOrderAmount] = tiers[user.memberTier] ?? tiers.Member;
      const code = await this.uniqueCouponCode(
        tx,
        () => `${prefix}${randomInt(1000, 10000)}`,
      );
      const endDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
      ));

      await tx.$executeRawUnsafe(
        `INSERT INTO MaGiamGia
           (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, DaSuDung,
            NgayBatDau, NgayKetThuc, TrangThai)
         VALUES (?, 'percent', ?, ?, NULL, 1, 0, ?, ?, 1)`,
        code,
        percent,
        minOrderAmount,
        now,
        endDate,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO LichSuDiem
           (NguoiDungId, LoaiGiaoDich, SoDiem, SoDuSauGiaoDich, DonHangId, MoTa)
         VALUES (?, 'bonus', 0, ?, NULL, ?)`,
        userId,
        toNumber(user.loyaltyPoints),
        `Voucher sinh nhật ${percent}% — mã ${code}`,
      );

      return {
        code,
        percent,
        minOrderAmount,
        endDate,
        message: `Chúc mừng sinh nhật! Bạn vừa nhận voucher giảm ${percent}%.`,
      };
    });
  }

  async deleteAccount(userId: number, confirm: unknown) {
    if (
      typeof confirm !== "string" ||
      confirm.trim().toUpperCase() !== "DELETE"
    ) {
      throw new BadRequestException("Vui lòng nhập DELETE để xác nhận.");
    }

    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRawUnsafe<Array<{
        id: unknown;
        avatar: string | null;
      }>>(
        "SELECT Id AS id, AnhDaiDien AS avatar FROM NguoiDung WHERE Id = ? FOR UPDATE",
        userId,
      );
      const user = users[0];
      if (!user) return null;

      await tx.$executeRawUnsafe(
        `UPDATE NguoiDung
         SET HoTen = ?, Email = ?, SoDienThoai = NULL, AnhDaiDien = NULL,
             NgaySinh = NULL, DiemThuong = 0, CapBac = 'Member'
         WHERE Id = ?`,
        `Người dùng đã hủy #${userId}`,
        `deleted-${userId}@kaitokid.local`,
        userId,
      );

      await tx.$executeRawUnsafe(
        `UPDATE MaGiamGia
         SET TrangThai = 0
         WHERE TrangThai = 1
           AND (MaCoupon LIKE ? OR MaCoupon LIKE ?)`,
        `PT${userId}-%`,
        `BD${userId}-%`,
      );

      await this.cart.clearCartInTransaction(tx, userId);

      await tx.$executeRawUnsafe(
        "DELETE FROM DanhSachYeuThich WHERE NguoiDungId = ?",
        userId,
      );
      await tx.$executeRawUnsafe(
        "DELETE FROM DiaChi WHERE NguoiDungId = ?",
        userId,
      );
      await tx.$executeRawUnsafe(
        "DELETE FROM ThongBao WHERE NguoiDungId = ?",
        userId,
      );
      await tx.$executeRawUnsafe(
        "UPDATE DanhGia SET TenKhachHang = 'Người dùng ẩn danh' WHERE NguoiDungId = ?",
        userId,
      );

      return { oldAvatar: user.avatar };
    });
  }

  private async userExists(userId: number): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT Id AS id FROM NguoiDung WHERE Id = ? LIMIT 1",
      userId,
    );
    return rows.length > 0;
  }

  private async uniqueCouponCode(tx: any, makeCode: () => string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = makeCode();
      const rows = await tx.$queryRawUnsafe(
        "SELECT Id FROM MaGiamGia WHERE MaCoupon = ? LIMIT 1",
        code,
      );
      if (!Array.isArray(rows) || rows.length === 0) return code;
    }
    throw new Error("Không thể sinh mã voucher duy nhất.");
  }

  private yyMMdd(date: Date): string {
    return [
      String(date.getUTCFullYear()).slice(-2),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("");
  }
}
