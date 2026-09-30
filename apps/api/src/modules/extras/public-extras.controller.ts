import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { randomInt } from "node:crypto";
import { pathInt } from "../../common/query-value.js";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { tryAuthenticateBearer } from "../../auth/jwt-optional.js";

interface RequestLike {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: {
    authorization?: string;
    "user-agent"?: string | string[];
    host?: string;
  };
  protocol?: string;
}

@Controller("api/attributes")
export class AttributesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query("group") group?: string) {
    const where = group?.trim() ? "WHERE NhomThuocTinh = ?" : "";
    const params = group?.trim() ? [group.trim()] : [];
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown;
      name: string;
      value: string;
      group: string | null;
      order: unknown;
    }>>(
      `SELECT Id AS id, TenThuocTinh AS name, GiaTri AS value,
              NhomThuocTinh AS \`group\`, ThuTu AS \`order\`
       FROM ThuocTinhSanPham
       ${where}
       ORDER BY ThuTu`,
      ...params,
    );
    return rows.map((row) => ({
      id: toNumber(row.id),
      tenThuocTinh: row.name,
      giaTri: row.value,
      nhomThuocTinh: row.group,
      thuTu: toNumber(row.order),
    }));
  }
}

@Controller("api/newsletter")
export class NewsletterController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("subscribe")
  async subscribe(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const source =
      typeof body.source === "string" ? body.source.trim() || null : null;
    if (!email || !email.includes("@")) {
      throw new BadRequestException({ message: "Email không hợp lệ" });
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<Array<{
        id: unknown;
        voucherCode: string | null;
        unsubscribedAt: Date | string | null;
      }>>(
        `SELECT Id AS id, VoucherCode AS voucherCode,
                UnsubscribedAt AS unsubscribedAt
         FROM DangKyNewsletter
         WHERE Email = ?
         ORDER BY Id DESC LIMIT 1
         FOR UPDATE`,
        email,
      );
      const current = existing[0];
      if (current && !current.unsubscribedAt) {
        return {
          message:
            "Bạn đã đăng ký rồi. Voucher đã được gửi qua email trước đó.",
          code: current.voucherCode,
        };
      }

      const now = new Date();
      const code =
        `WELCOME-${String(now.getUTCFullYear()).slice(-2)}` +
        `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
        `${String(now.getUTCDate()).padStart(2, "0")}-` +
        String(randomInt(1000, 10000));
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);

      await tx.$executeRawUnsafe(
        `INSERT INTO MaGiamGia
           (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa,
            SoLuotDung, DaSuDung, NgayBatDau, NgayKetThuc, TrangThai)
         VALUES (?, 'percent', 10, 200000, 50000, 1, 0, ?, ?, 1)`,
        code,
        now,
        expiresAt,
      );

      if (current) {
        await tx.$executeRawUnsafe(
          `UPDATE DangKyNewsletter
           SET UnsubscribedAt=NULL, VoucherCode=?, Source=?
           WHERE Id=?`,
          code,
          source,
          toNumber(current.id),
        );
      } else {
        const ua = req.headers["user-agent"];
        await tx.$executeRawUnsafe(
          `INSERT INTO DangKyNewsletter
             (Email, Source, VoucherCode, Ip, UserAgent, SubscribedAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          email,
          source,
          code,
          req.ip ?? req.socket?.remoteAddress ?? null,
          Array.isArray(ua) ? ua.join(" ") : ua ?? null,
          now,
        );
      }
      return {
        message:
          "Đăng ký thành công! Mã giảm giá 10% đã được tạo.",
        code,
        expiresAt,
      };
    });
  }
}

@Controller("api/products")
export class ProductExtrasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":id/variants")
  async variants(@Param("id") rawId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      size: string;
      color: string;
      stock: unknown;
      soldCount: unknown;
    }>>(
      `SELECT KichCo AS size, MauSac AS color, SoLuong AS stock,
              SoLuongDaBan AS soldCount
       FROM TonKhoBienThe
       WHERE SanPhamId=? AND SoLuong > 0`,
      pathInt(rawId),
    );
    return rows.map((row) => ({
      size: row.size,
      color: row.color,
      stock: toNumber(row.stock),
      soldCount: toNumber(row.soldCount),
    }));
  }

  @Get("size-chart")
  async sizeChart(@Query("type") type = "top") {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT TenSize AS size, Vai AS shoulder, Nguc AS chest,
              Eo AS waist, Hong AS hip, DaiAo AS topLength,
              DaiQuan AS bottomLength, ChieuCao AS height,
              CanNang AS weight
       FROM BangSize
       WHERE TrangThai=1 AND Loai=?
       ORDER BY ThuTu`,
      type,
    );
    return {
      type,
      items: rows.map((row) => ({
        size: row.size,
        shoulder: row.shoulder,
        chest: row.chest,
        waist: row.waist,
        hip: row.hip,
        topLength: row.topLength,
        bottomLength: row.bottomLength,
        height: row.height,
        weight: row.weight,
      })),
    };
  }

  @Get(":id/qa")
  async qa(@Param("id") rawId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT Id AS id, TenNguoiHoi AS askerName, CauHoi AS question,
              TraLoi AS answer, NguoiTraLoi AS answeredBy,
              TrangThai AS status, NgayHoi AS askedAt,
              NgayTraLoi AS answeredAt, LuotHuuIch AS helpfulCount
       FROM CauHoiSanPham
       WHERE SanPhamId=? AND TrangThai IN ('answered','pending')
       ORDER BY NgayHoi DESC LIMIT 50`,
      pathInt(rawId),
    );
    return rows.map((row) => ({
      id: toNumber(row.id),
      askerName: row.askerName,
      question: row.question,
      answer: row.answer,
      answeredBy: row.answeredBy,
      status: row.status,
      askedAt: row.askedAt,
      answeredAt: row.answeredAt,
      helpfulCount: toNumber(row.helpfulCount),
    }));
  }

  @Post("qa/ask")
  async ask(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    const productId = Number(body.productId);
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new BadRequestException({ message: "Sản phẩm không hợp lệ" });
    }
    if (question.length < 5) {
      throw new BadRequestException({
        message: "Câu hỏi phải có ít nhất 5 ký tự",
      });
    }
    const user = tryAuthenticateBearer(req.headers.authorization);
    const askerName =
      user?.name ??
      (typeof body.askerName === "string" && body.askerName.trim()
        ? body.askerName.trim()
        : "Khách");
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO CauHoiSanPham
         (SanPhamId, NguoiHoiId, TenNguoiHoi, CauHoi, TrangThai, NgayHoi)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      productId,
      user?.id ?? null,
      askerName,
      question,
      new Date(),
    );
    const ids = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT LAST_INSERT_ID() AS id",
    );
    return {
      message:
        "Câu hỏi đã được gửi. Shop sẽ trả lời trong vòng 24 giờ.",
      id: toNumber(ids[0]?.id),
    };
  }

  @Post(":id/viewers/heartbeat")
  async heartbeat(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const productId = pathInt(rawId);
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) throw new BadRequestException();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id FROM PhienXemSanPham
         WHERE SanPhamId=? AND SessionId=?
         ORDER BY Id DESC LIMIT 1
         FOR UPDATE`,
        productId,
        sessionId,
      );
      if (rows[0]) {
        await tx.$executeRawUnsafe(
          "UPDATE PhienXemSanPham SET LastSeenAt=? WHERE Id=?",
          now,
          toNumber(rows[0].id),
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO PhienXemSanPham
             (SanPhamId, SessionId, Ip, LastSeenAt)
           VALUES (?, ?, ?, ?)`,
          productId,
          sessionId,
          req.ip ?? req.socket?.remoteAddress ?? null,
          now,
        );
      }
    });

    const count = await this.prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
      `SELECT COUNT(*) AS count
       FROM PhienXemSanPham
       WHERE SanPhamId=? AND LastSeenAt >= ?`,
      productId,
      new Date(now.getTime() - 2 * 60_000),
    );
    return { viewers: toNumber(count[0]?.count) };
  }
}
