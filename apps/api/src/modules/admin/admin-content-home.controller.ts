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

@Controller("api/admin/homepage-blocks")
@UseGuards(JwtAuthGuard)
export class AdminHomepageBlocksController {
  constructor(private readonly prisma: PrismaService) {}
  private map(row: JsonRecord) {
    return {
      id: Number(row.Id), blockType: row.BlockType, title: row.TieuDe, subtitle: row.TieuDePhu,
      description: row.MoTa, image: row.HinhAnh, link: row.LienKet, icon: row.Icon,
      sortOrder: Number(row.ThuTu ?? 0), isActive: Boolean(row.TrangThai), createdAt: row.NgayTao, updatedAt: row.NgayCapNhat,
    };
  }
  @Get()
  async all(@CurrentUser() user: AuthenticatedUser, @Query("type") type?: string) {
    permission(user, "homepage.manage");
    const rows = type?.trim()
      ? await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM HomepageBlock WHERE BlockType=? ORDER BY BlockType, ThuTu", type.trim())
      : await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM HomepageBlock ORDER BY BlockType, ThuTu");
    return rows.map((row) => this.map(row));
  }
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "homepage.manage");
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "HomepageBlock", {
        BlockType: text(body, "BlockType"), TieuDe: nullableText(body, "Title"), TieuDePhu: nullableText(body, "Subtitle"),
        MoTa: nullableText(body, "Description"), HinhAnh: nullableText(body, "Image"), LienKet: nullableText(body, "Link"),
        Icon: nullableText(body, "Icon"), ThuTu: num(body, "SortOrder"), TrangThai: bool(body, "IsActive", true), NgayTao: new Date(),
      }); return this.map((await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM HomepageBlock WHERE Id=?", id))[0]);
    });
  }
  @Put(":id")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "homepage.manage"); const id = intPath(rawId);
    const row = await updateRow(this.prisma, "HomepageBlock", id, {
      BlockType: text(body, "BlockType"), TieuDe: nullableText(body, "Title"), TieuDePhu: nullableText(body, "Subtitle"),
      MoTa: nullableText(body, "Description"), HinhAnh: nullableText(body, "Image"), LienKet: nullableText(body, "Link"),
      Icon: nullableText(body, "Icon"), ThuTu: num(body, "SortOrder"), TrangThai: bool(body, "IsActive", true), NgayCapNhat: new Date(),
    });
    return this.map({ Id: row.id, BlockType: row.blockType, TieuDe: row.tieuDe, TieuDePhu: row.tieuDePhu, MoTa: row.moTa, HinhAnh: row.hinhAnh, LienKet: row.lienKet, Icon: row.icon, ThuTu: row.thuTu, TrangThai: row.trangThai, NgayTao: row.ngayTao, NgayCapNhat: row.ngayCapNhat });
  }
  @Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) { permission(user, "homepage.manage"); await deleteRow(this.prisma, "HomepageBlock", intPath(rawId)); }
}

@Controller("api/admin/homepage")
@UseGuards(JwtAuthGuard, AdminStaffGuard)
export class AdminHomepageController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async all() { return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM CauHinhTrangChu ORDER BY ThuTu")); }
  @Put()
  async update(@Body() body: unknown) {
    if (!Array.isArray(body)) throw new BadRequestException({ error: "Dữ liệu section không hợp lệ." });
    await this.prisma.$transaction(async (tx) => {
      for (const raw of body as JsonRecord[]) {
        const name = text(raw, "TenSection"); if (!name) continue;
        const existing = await tx.$queryRawUnsafe<Array<{ Id: unknown }>>("SELECT Id FROM CauHinhTrangChu WHERE TenSection=? LIMIT 1 FOR UPDATE", name);
        const values = { DanhSachSPId: nullableText(raw, "DanhSachSPId"), ThuTu: num(raw, "ThuTu"), TrangThai: bool(raw, "TrangThai", true), NgayCapNhat: new Date() };
        if (existing[0]) await updateRow(tx, "CauHinhTrangChu", Number(existing[0].Id), values);
        else await insertRow(tx, "CauHinhTrangChu", { TenSection: name, ...values });
      }
    });
    return { message: "Đã cập nhật trang chủ" };
  }
}
