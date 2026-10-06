import {
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
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { PrismaService } from "../../database/prisma.service.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { AdminStaffGuard } from "./admin-staff.guard.js";
import {
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

@Controller("api/admin/customers")
@UseGuards(JwtAuthGuard)
export class AdminCustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    assertStaffPermission(user, "customers.view");
    const { page, pageSize, offset } = pageValues(rawPage, rawPageSize);
    const filter = search?.trim();
    const where = filter
      ? "VaiTro='user' AND (HoTen LIKE ? OR Email LIKE ? OR SoDienThoai LIKE ?)"
      : "VaiTro='user'";
    const params = filter ? [`%${filter}%`, `%${filter}%`, `%${filter}%`] : [];
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(
      `SELECT COUNT(*) AS total FROM NguoiDung WHERE ${where}`,
      ...params,
    );
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT n.Id, n.HoTen, n.Email, n.SoDienThoai, n.VaiTro, n.TrangThai, n.NgayTao,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS OrderCount,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed') AS CompletedOrders,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='cancelled') AS CancelledOrders,
              COALESCE((SELECT SUM(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'),0) AS TotalSpent,
              COALESCE((SELECT AVG(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'),0) AS AverageOrderValue,
              (SELECT MIN(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS FirstOrderAt,
              (SELECT MAX(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS LastOrderAt,
              (SELECT d.TrangThai FROM DonHang d WHERE d.NguoiDungId=n.Id ORDER BY d.NgayTao DESC, d.Id DESC LIMIT 1) AS LastOrderStatus,
              (SELECT MAX(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed') AS LastCompletedOrderAt
       FROM NguoiDung n WHERE ${where}
       ORDER BY n.NgayTao DESC LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    );
    const total = Number(totals[0]?.total ?? 0);
    return { items: jsonRows(rows), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  @Get(":id/analytics")
  async analytics(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    assertStaffPermission(user, "customers.view");
    const id = intPath(rawId);
    const customerRows = await this.prisma.$queryRawUnsafe<Array<{ Id: unknown }>>(
      "SELECT Id FROM NguoiDung WHERE Id=? AND VaiTro='user' LIMIT 1",
      id,
    );
    if (!customerRows[0]) throw new NotFoundException();

    const [orderRows, productRows, categoryRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<JsonRecord[]>(
        `SELECT d.Id, d.MaDonHang AS OrderCode, d.TongTien AS Total, d.TrangThai AS Status,
                d.NgayTao AS CreatedAt, COUNT(ct.Id) AS ItemCount
         FROM DonHang d
         LEFT JOIN ChiTietDonHang ct ON ct.DonHangId=d.Id
         WHERE d.NguoiDungId=?
         GROUP BY d.Id, d.MaDonHang, d.TongTien, d.TrangThai, d.NgayTao
         ORDER BY d.NgayTao DESC, d.Id DESC`,
        id,
      ),
      this.prisma.$queryRawUnsafe<JsonRecord[]>(
        `SELECT ct.TenSanPham AS Product, SUM(ct.SoLuong) AS Quantity
         FROM DonHang d
         JOIN ChiTietDonHang ct ON ct.DonHangId=d.Id
         WHERE d.NguoiDungId=? AND d.TrangThai='completed'
         GROUP BY ct.SanPhamId, ct.TenSanPham
         ORDER BY Quantity DESC, Product ASC
         LIMIT 4`,
        id,
      ),
      this.prisma.$queryRawUnsafe<JsonRecord[]>(
        `SELECT COALESCE(NULLIF(TRIM(p.DanhMuc), ''), 'Khác') AS Category, SUM(ct.SoLuong) AS Quantity
         FROM DonHang d
         JOIN ChiTietDonHang ct ON ct.DonHangId=d.Id
         LEFT JOIN SanPham p ON p.Id=ct.SanPhamId
         WHERE d.NguoiDungId=? AND d.TrangThai='completed'
         GROUP BY Category
         ORDER BY Quantity DESC, Category ASC
         LIMIT 3`,
        id,
      ),
    ]);

    const products = jsonRows(productRows);
    const categories = jsonRows(categoryRows);
    return {
      topCategories: categories.map((row) => String(row.category ?? "")).filter(Boolean),
      purchasedProducts: products.map((row) => String(row.product ?? "")).filter(Boolean),
      orders: jsonRows(orderRows),
    };
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    assertStaffPermission(user, "customers.view");
    const id = intPath(rawId);
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT n.Id, n.HoTen, n.Email, n.SoDienThoai, n.VaiTro, n.TrangThai, n.NgayTao,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS orderCount,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed') AS completedOrders,
              (SELECT COUNT(*) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='cancelled') AS cancelledOrders,
              COALESCE((SELECT SUM(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'),0) AS totalSpent,
              COALESCE((SELECT AVG(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'),0) AS averageOrderValue,
              (SELECT MIN(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS firstOrderAt,
              (SELECT MAX(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id) AS lastOrderAt,
              (SELECT d.TrangThai FROM DonHang d WHERE d.NguoiDungId=n.Id ORDER BY d.NgayTao DESC, d.Id DESC LIMIT 1) AS lastOrderStatus,
              (SELECT MAX(d.NgayTao) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed') AS lastCompletedOrderAt
       FROM NguoiDung n WHERE n.Id=? AND n.VaiTro='user' LIMIT 1`,
      id,
    );
    if (!rows[0]) throw new NotFoundException();
    return jsonValue(rows[0]);
  }

  @Put(":id/toggle-status")
  async toggle(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    assertStaffPermission(user, "customers.manage");
    const id = intPath(rawId);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ TrangThai: unknown }>>(
        "SELECT TrangThai FROM NguoiDung WHERE Id=? AND VaiTro='user' LIMIT 1 FOR UPDATE",
        id,
      );
      if (!rows[0]) throw new NotFoundException();
      const next = Number(rows[0].TrangThai) ? 0 : 1;
      await tx.$executeRawUnsafe("UPDATE NguoiDung SET TrangThai=?, NgayCapNhat=? WHERE Id=? AND VaiTro='user'", next, new Date(), id);
      return { id, trangThai: Boolean(next) };
    });
  }
}

@Controller("api/admin/products")
@UseGuards(JwtAuthGuard, AdminStaffGuard)
export class AdminProductsController {
  constructor(private readonly prisma: PrismaService) {}

  private values(body: JsonRecord, creating = false): Record<string, unknown> {
    return {
      TenSanPham: text(body, "TenSanPham"),
      DanhMucId: nullableNum(body, "DanhMucId"),
      DanhMuc: text(body, "DanhMuc"),
      DanhMucPhu: nullableText(body, "DanhMucPhu"),
      PhongCach: nullableText(body, "PhongCach"),
      ...(creating ? { NhomTuoi: nullableText(body, "NhomTuoi") } : {}),
      GioiTinh: text(body, "GioiTinh"),
      Gia: num(body, "Gia"),
      GiaCu: nullableNum(body, "GiaCu"),
      TonKho: num(body, "TonKho"),
      TrangThai: text(body, "TrangThai", "active"),
      HinhAnh: text(body, "HinhAnh"),
      DanhSachAnh: nullableText(body, "DanhSachAnh"),
      MoTaNgan: nullableText(body, "MoTaNgan"),
      MoTaChiTiet: text(body, "MoTaChiTiet"),
      MaSanPham: text(body, "MaSanPham"),
      Slug: nullableText(body, "Slug"),
      ...(creating ? { Menu: nullableText(body, "Menu") } : {}),
      BoSuuTapId: nullableNum(body, "BoSuuTapId"),
      MetaTitle: nullableText(body, "MetaTitle"),
      MetaDescription: nullableText(body, "MetaDescription"),
      LaSanPhamMoi: bool(body, "LaSanPhamMoi"),
      DangGiamGia: bool(body, "DangGiamGia"),
      BanChayNhat: bool(body, "BanChayNhat"),
      ...(creating ? { DiemDanhGia: num(body, "DiemDanhGia"), SoLuongDaBan: num(body, "SoLuongDaBan") } : {}),
      DanhSachMau: nullableText(body, "DanhSachMau"),
      DanhSachSize: nullableText(body, "DanhSachSize"),
      BienThe: nullableText(body, "BienThe"),
      ThongSoKyThuat: nullableText(body, "ThongSoKyThuat"),
      ...(creating ? { NgayTao: new Date() } : { NgayCapNhat: new Date() }),
    };
  }

  @Get()
  async all(
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    const { page, pageSize, offset } = pageValues(rawPage, rawPageSize);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (search?.trim()) { clauses.push("(TenSanPham LIKE ? OR MaSanPham LIKE ?)"); params.push(`%${search.trim()}%`, `%${search.trim()}%`); }
    if (category?.trim()) { clauses.push("DanhMuc=?"); params.push(category.trim()); }
    if (status?.trim()) { clauses.push("TrangThai=?"); params.push(status.trim()); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(`SELECT COUNT(*) AS total FROM SanPham ${where}`, ...params);
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(`SELECT * FROM SanPham ${where} ORDER BY NgayTao DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { items: jsonRows(rows), total: Number(totals[0]?.total ?? 0), page, pageSize };
  }

  @Get(":id")
  one(@Param("id") rawId: string) { return selectById(this.prisma, "SanPham", intPath(rawId)); }

  @Post()
  async create(@Body() body: JsonRecord) {
    return this.prisma.$transaction(async (tx) => {
      const id = await insertRow(tx, "SanPham", this.values(body, true));
      return selectById(tx, "SanPham", id);
    });
  }

  @Put(":id")
  update(@Param("id") rawId: string, @Body() body: JsonRecord) {
    return updateRow(this.prisma, "SanPham", intPath(rawId), this.values(body));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") rawId: string) { await deleteRow(this.prisma, "SanPham", intPath(rawId)); }
}

@Controller("api/admin/reports")
@UseGuards(JwtAuthGuard)
export class AdminReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard")
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    assertStaffPermission(user, "dashboard.view");
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT
        (SELECT COUNT(*) FROM SanPham) AS totalProducts,
        (SELECT COUNT(*) FROM DonHang) AS totalOrders,
        (SELECT COUNT(*) FROM NguoiDung WHERE VaiTro='user') AS totalCustomers,
        COALESCE((SELECT SUM(TongTien) FROM DonHang WHERE TrangThai='completed'),0) AS totalRevenue,
        (SELECT COUNT(*) FROM DonHang WHERE TrangThai='pending') AS pendingOrders,
        (SELECT COUNT(*) FROM SanPham WHERE TonKho<=5 AND TrangThai='active') AS lowStockProducts,
        (SELECT COUNT(*) FROM DanhGia WHERE TrangThai='pending') AS pendingReviews`,
    );
    return jsonValue(rows[0] ?? {});
  }

  @Get("revenue")
  async revenue(@CurrentUser() user: AuthenticatedUser, @Query("days") rawDays = "30") {
    assertStaffPermission(user, "reports.view");
    const days = Math.max(1, Math.min(3650, Number(rawDays) || 30));
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60_000);
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT DATE(NgayTao) AS date, SUM(TongTien) AS revenue, COUNT(*) AS orders
       FROM DonHang WHERE TrangThai='completed' AND NgayTao>=?
       GROUP BY DATE(NgayTao) ORDER BY date`, fromDate,
    ));
  }

  @Get("top-products")
  async topProducts(@CurrentUser() user: AuthenticatedUser, @Query("count") rawCount = "10", @Query("days") rawDays = "30") {
    assertStaffPermission(user, "reports.view");
    const count = Math.max(1, Math.min(100, Number(rawCount) || 10));
    const days = Math.max(1, Math.min(3650, Number(rawDays) || 30));
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60_000);
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT p.Id, p.TenSanPham, p.MaSanPham, p.HinhAnh, p.Gia,
              SUM(ct.SoLuong) AS SoLuongDaBan, p.TonKho
       FROM ChiTietDonHang ct
       JOIN DonHang d ON d.Id=ct.DonHangId
       LEFT JOIN SanPham p ON p.Id=ct.SanPhamId
       WHERE d.TrangThai='completed' AND d.NgayTao>=?
       GROUP BY p.Id, p.TenSanPham, p.MaSanPham, p.HinhAnh, p.Gia, p.TonKho
       ORDER BY SoLuongDaBan DESC LIMIT ?`, fromDate, count,
    ));
  }

  @Get("order-stats")
  async orderStats(@CurrentUser() user: AuthenticatedUser, @Query("days") rawDays = "30") {
    assertStaffPermission(user, "reports.view");
    const days = Math.max(1, Math.min(3650, Number(rawDays) || 30));
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60_000);
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT TrangThai AS status, COUNT(*) AS count, SUM(TongTien) AS total
       FROM DonHang WHERE NgayTao>=?
       GROUP BY TrangThai`, fromDate,
    ));
  }
}
