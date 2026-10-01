import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { PrismaService } from "../../database/prisma.service.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { AdminStaffGuard } from "./admin-staff.guard.js";
import {
  bodyValue,
  bool,
  date,
  deleteRow,
  insertRow,
  intPath,
  jsonRows,
  jsonValue,
  nullableNum,
  nullableText,
  num,
  pageValues,
  selectById,
  text,
  updateRow,
  type JsonRecord,
} from "./admin-utils.js";

function permission(user: AuthenticatedUser, name: string): void {
  assertStaffPermission(user, name);
}

@Controller("api/admin/collections")
@UseGuards(JwtAuthGuard)
export class AdminCollectionsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async all(@CurrentUser() user: AuthenticatedUser) {
    permission(user, "collections.manage");
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM BoSuuTap ORDER BY ThuTu"));
  }
  private values(body: JsonRecord, creating = false) {
    return {
      TenBoSuuTap: text(body, "TenBoSuuTap"), Slug: nullableText(body, "Slug"),
      MoTa: nullableText(body, "MoTa"), HinhAnh: nullableText(body, "HinhAnh"),
      TrangThai: bool(body, "TrangThai", true), ThuTu: num(body, "ThuTu"),
      ...(creating ? { NgayTao: date(body, "NgayTao", new Date()) } : {}),
    };
  }
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "collections.manage");
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "BoSuuTap", this.values(body, true));
      return selectById(tx, "BoSuuTap", id);
    });
  }
  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "collections.manage");
    return updateRow(this.prisma, "BoSuuTap", intPath(rawId), this.values(body));
  }
  @Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "collections.manage"); await deleteRow(this.prisma, "BoSuuTap", intPath(rawId));
  }
}

@Controller("api/admin/coupons")
@UseGuards(JwtAuthGuard)
export class AdminCouponsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async all(@CurrentUser() user: AuthenticatedUser) {
    permission(user, "coupons.manage");
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM MaGiamGia ORDER BY NgayTao DESC"));
  }
  private values(body: JsonRecord, creating = false) {
    return {
      MaCoupon: text(body, "MaCoupon"), LoaiGiamGia: text(body, "LoaiGiamGia", "percent"),
      GiaTri: num(body, "GiaTri"), DonToiThieu: nullableNum(body, "DonToiThieu"), GiamToiDa: nullableNum(body, "GiamToiDa"),
      SoLuotDung: num(body, "SoLuotDung"), ...(creating ? { DaSuDung: num(body, "DaSuDung") } : {}),
      NgayBatDau: date(body, "NgayBatDau"), NgayKetThuc: date(body, "NgayKetThuc"),
      TrangThai: bool(body, "TrangThai", true), MoTa: nullableText(body, "MoTa"),
      ...(creating ? { NgayTao: date(body, "NgayTao", new Date()) } : {}),
    };
  }
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "coupons.manage");
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "MaGiamGia", this.values(body, true)); return selectById(tx, "MaGiamGia", id);
    });
  }
  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "coupons.manage"); return updateRow(this.prisma, "MaGiamGia", intPath(rawId), this.values(body));
  }
  @Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "coupons.manage"); await deleteRow(this.prisma, "MaGiamGia", intPath(rawId));
  }
}

@Controller("api/admin/flash-sales")
@UseGuards(JwtAuthGuard)
export class AdminFlashSalesController {
  constructor(private readonly prisma: PrismaService) {}

  private async hydrate(where: string, ...params: unknown[]) {
    const sales = await this.prisma.$queryRawUnsafe<JsonRecord[]>(`SELECT * FROM FlashSale ${where}`, ...params);
    const result = [] as JsonRecord[];
    for (const raw of sales) {
      const sale = jsonValue(raw) as JsonRecord;
      const id = Number(raw.Id ?? raw.id);
      sale.chiTiet = jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietFlashSale WHERE FlashSaleId=? ORDER BY Id", id));
      result.push(sale);
    }
    return result;
  }

  @Get()
  async all(@CurrentUser() user: AuthenticatedUser) {
    permission(user, "flash_sales.manage"); return this.hydrate("ORDER BY NgayTao DESC");
  }
  @Get(":id")
  async one(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "flash_sales.manage");
    const rows = await this.hydrate("WHERE Id=? LIMIT 1", intPath(rawId));
    if (!rows[0]) throw new NotFoundException(); return rows[0];
  }
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "flash_sales.manage");
    const details = Array.isArray(bodyValue(body, "ChiTiet")) ? bodyValue(body, "ChiTiet") as JsonRecord[] : [];
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "FlashSale", {
        TenFlashSale: text(body, "TenFlashSale"), NgayBatDau: date(body, "NgayBatDau"),
        NgayKetThuc: date(body, "NgayKetThuc"), TrangThai: bool(body, "TrangThai", true), NgayTao: new Date(),
      });
      for (const item of details) await insertRow(tx, "ChiTietFlashSale", {
        FlashSaleId: id, SanPhamId: num(item, "SanPhamId"), GiaFlashSale: num(item, "GiaFlashSale"),
        SoLuongGioiHan: num(item, "SoLuongGioiHan"), DaBan: num(item, "DaBan"),
      });
      const sale = await selectById(tx, "FlashSale", id);
      sale.chiTiet = jsonRows(await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietFlashSale WHERE FlashSaleId=? ORDER BY Id", id));
      return sale;
    });
  }
  @Put(":id")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "flash_sales.manage"); const id = intPath(rawId);
    const details = Array.isArray(bodyValue(body, "ChiTiet")) ? bodyValue(body, "ChiTiet") as JsonRecord[] : [];
    return this.prisma.$transaction(async (tx) => {
      await updateRow(tx, "FlashSale", id, {
        TenFlashSale: text(body, "TenFlashSale"), NgayBatDau: date(body, "NgayBatDau"),
        NgayKetThuc: date(body, "NgayKetThuc"), TrangThai: bool(body, "TrangThai", true),
      });
      await tx.$executeRawUnsafe("DELETE FROM ChiTietFlashSale WHERE FlashSaleId=?", id);
      for (const item of details) await insertRow(tx, "ChiTietFlashSale", {
        FlashSaleId: id, SanPhamId: num(item, "SanPhamId"), GiaFlashSale: num(item, "GiaFlashSale"),
        SoLuongGioiHan: num(item, "SoLuongGioiHan"), DaBan: num(item, "DaBan"),
      });
      const sale = await selectById(tx, "FlashSale", id);
      sale.chiTiet = jsonRows(await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietFlashSale WHERE FlashSaleId=? ORDER BY Id", id));
      return sale;
    });
  }
  @Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "flash_sales.manage"); const id = intPath(rawId);
    await this.prisma.$transaction(async (tx) => { await selectById(tx, "FlashSale", id); await tx.$executeRawUnsafe("DELETE FROM ChiTietFlashSale WHERE FlashSaleId=?", id); await tx.$executeRawUnsafe("DELETE FROM FlashSale WHERE Id=?", id); });
  }
}

@Controller("api/flash-sales")
export class FlashSalesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("active")
  async active() {
    const sales = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      "SELECT * FROM FlashSale WHERE TrangThai=1 AND NgayBatDau<=UTC_TIMESTAMP() AND NgayKetThuc>=UTC_TIMESTAMP() ORDER BY NgayKetThuc LIMIT 1",
    );
    const fs = sales[0]; if (!fs) return { active: false };
    const details = await this.prisma.$queryRawUnsafe<Array<JsonRecord>>(
      `SELECT c.Id AS id, c.SanPhamId AS productId, p.TenSanPham AS name, p.HinhAnh AS image,
              p.Gia AS originalPrice, c.GiaFlashSale AS flashPrice, c.SoLuongGioiHan AS stockLimit,
              c.DaBan AS sold, p.DanhMuc AS category, p.GioiTinh AS gender
       FROM ChiTietFlashSale c LEFT JOIN SanPham p ON p.Id=c.SanPhamId WHERE c.FlashSaleId=? ORDER BY c.Id`,
      Number(fs.Id),
    );
    return {
      active: true, id: Number(fs.Id), name: fs.TenFlashSale,
      startDate: fs.NgayBatDau, endDate: fs.NgayKetThuc, items: jsonRows(details),
    };
  }
}

