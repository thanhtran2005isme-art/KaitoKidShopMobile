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

@Controller("api/admin/attributes")
@UseGuards(JwtAuthGuard)
export class AdminAttributesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(@CurrentUser() user: AuthenticatedUser, @Query("group") group?: string) {
    permission(user, "attributes.manage");
    const rows = group?.trim()
      ? await this.prisma.$queryRawUnsafe<JsonRecord[]>(
          "SELECT * FROM ThuocTinhSanPham WHERE NhomThuocTinh=? ORDER BY ThuTu",
          group.trim(),
        )
      : await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ThuocTinhSanPham ORDER BY ThuTu");
    return jsonRows(rows);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "attributes.manage");
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "ThuocTinhSanPham", {
        TenThuocTinh: text(body, "TenThuocTinh"),
        GiaTri: text(body, "GiaTri"),
        NhomThuocTinh: nullableText(body, "NhomThuocTinh"),
        ThuTu: num(body, "ThuTu"),
        NgayTao: date(body, "NgayTao", new Date()),
      });
      return selectById(tx, "ThuocTinhSanPham", id);
    });
  }

  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "attributes.manage");
    return updateRow(this.prisma, "ThuocTinhSanPham", intPath(rawId), {
      TenThuocTinh: text(body, "TenThuocTinh"),
      GiaTri: text(body, "GiaTri"),
      NhomThuocTinh: nullableText(body, "NhomThuocTinh"),
      ThuTu: num(body, "ThuTu"),
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "attributes.manage");
    await deleteRow(this.prisma, "ThuocTinhSanPham", intPath(rawId));
  }
}

@Controller("api/admin/banners")
@UseGuards(JwtAuthGuard)
export class AdminBannersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(@CurrentUser() user: AuthenticatedUser) {
    permission(user, "banners.manage");
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM Banner ORDER BY ThuTu"));
  }

  private values(body: JsonRecord, creating = false) {
    return {
      TieuDe: text(body, "TieuDe"),
      TieuDePhu: nullableText(body, "TieuDePhu"),
      MoTa: nullableText(body, "MoTa"),
      HinhAnh: text(body, "HinhAnh"),
      LienKet: nullableText(body, "LienKet"),
      LoaiBanner: text(body, "LoaiBanner", "slider"),
      ViTri: text(body, "ViTri", "homepage"),
      ThuTu: num(body, "ThuTu"),
      TrangThai: text(body, "TrangThai", "active"),
      NgayBatDau: date(body, "NgayBatDau"),
      NgayKetThuc: date(body, "NgayKetThuc"),
      ...(creating ? { NgayTao: date(body, "NgayTao", new Date()) } : {}),
    };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "banners.manage");
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "Banner", this.values(body, true));
      return selectById(tx, "Banner", id);
    });
  }

  @Put(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "banners.manage");
    return updateRow(this.prisma, "Banner", intPath(rawId), this.values(body));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "banners.manage");
    await deleteRow(this.prisma, "Banner", intPath(rawId));
  }
}

@Controller("api/admin/categories")
@UseGuards(JwtAuthGuard, AdminStaffGuard)
export class AdminCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all() {
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM DanhMuc ORDER BY ThuTu"));
  }

  private values(body: JsonRecord, creating = false) {
    return {
      TenDanhMuc: text(body, "TenDanhMuc"),
      Slug: nullableText(body, "Slug"),
      MoTa: nullableText(body, "MoTa"),
      HinhAnh: nullableText(body, "HinhAnh"),
      DanhMucChaId: nullableNum(body, "DanhMucChaId"),
      ThuTu: num(body, "ThuTu"),
      TrangThai: bool(body, "TrangThai", true),
      GioiTinh: text(body, "GioiTinh", "all") || "all",
      ...(creating ? { NgayTao: date(body, "NgayTao", new Date()) } : {}),
    };
  }

  @Post()
  async create(@Body() body: JsonRecord) {
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "DanhMuc", this.values(body, true));
      return selectById(tx, "DanhMuc", id);
    });
  }

  @Put(":id")
  update(@Param("id") rawId: string, @Body() body: JsonRecord) {
    return updateRow(this.prisma, "DanhMuc", intPath(rawId), this.values(body));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") rawId: string) {
    await deleteRow(this.prisma, "DanhMuc", intPath(rawId));
  }
}

