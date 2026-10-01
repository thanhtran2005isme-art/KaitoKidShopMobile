import {
  BadRequestException,
  Body,
  Controller,
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
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { AdminStaffGuard } from "./admin-staff.guard.js";
import {
  bodyValue,
  calculateAdjustedStock,
  floorAtZero,
  intPath,
  insertRow,
  jsonRows,
  jsonValue,
  nullableNum,
  nullableText,
  num,
  pageValues,
  selectById,
  text,
  weightedAverageCost,
  type JsonRecord,
} from "./admin-utils.js";

function permission(user: AuthenticatedUser, name: string): void {
  assertStaffPermission(user, name);
}

function staffName(user: AuthenticatedUser): string {
  return user.name?.trim() || "Admin";
}

function parseOptionalDate(raw: string | undefined, label: string): Date | undefined {
  if (!raw?.trim()) return undefined;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new BadRequestException({ error: `${label} không hợp lệ.` });
  return value;
}

async function orderWithRelations(client: SqlClient, id: number) {
  const rows = await client.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM DonHang WHERE Id=? LIMIT 1", id);
  if (!rows[0]) throw new NotFoundException();
  const order = jsonValue(rows[0]) as JsonRecord;
  order.chiTiet = jsonRows(await client.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietDonHang WHERE DonHangId=? ORDER BY Id", id));
  const userId = Number(rows[0].NguoiDungId ?? 0);
  if (userId > 0) {
    const users = await client.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM NguoiDung WHERE Id=? LIMIT 1", userId);
    order.nguoiDung = users[0] ? jsonValue(users[0]) : null;
  } else {
    order.nguoiDung = null;
  }
  return order;
}

@Controller("api/admin/inventory")
@UseGuards(JwtAuthGuard)
export class AdminInventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("lowStock") rawLowStock?: string,
  ) {
    permission(user, "inventory.view");
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (search?.trim()) {
      clauses.push("(TenSanPham LIKE ? OR MaSanPham LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (rawLowStock?.toLowerCase() === "true") clauses.push("TonKho<=5");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT Id, TenSanPham, MaSanPham, HinhAnh, TonKho, SoLuongDaBan, TrangThai,
              DanhMuc, DanhMucPhu, GioiTinh, NgayTao, NgayCapNhat
       FROM SanPham ${where} ORDER BY TonKho`,
      ...params,
    ));
  }

  @Post("adjust")
  async adjust(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    permission(user, "inventory.manage");
    const productId = num(body, "SanPhamId");
    const quantity = num(body, "SoLuong", -1);
    const changeType = text(body, "LoaiThayDoi", "import") as "import" | "export" | "set";
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new BadRequestException({ error: "SanPhamId không hợp lệ." });
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new BadRequestException({ error: "SoLuong phải >= 0." });
    if (!["import", "export", "set"].includes(changeType)) throw new BadRequestException({ error: "LoaiThayDoi phải là import, export hoặc set." });

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM SanPham WHERE Id=? LIMIT 1 FOR UPDATE", productId);
      if (!rows[0]) throw new NotFoundException();
      const product = rows[0];
      const before = Number(product.TonKho ?? 0);
      let after: number;
      try {
        after = calculateAdjustedStock(before, quantity, changeType);
      } catch (error) {
        if (error instanceof Error && /insufficient stock/.test(error.message)) {
          throw new BadRequestException({ error: `Không đủ tồn kho. Hiện có ${before}, yêu cầu xuất ${quantity}.` });
        }
        throw error;
      }
      const currentStatus = String(product.TrangThai ?? "active");
      const status = after === 0 ? "out-of-stock" : currentStatus === "out-of-stock" ? "active" : currentStatus;
      const now = new Date();
      await tx.$executeRawUnsafe("UPDATE SanPham SET TonKho=?, TrangThai=?, NgayCapNhat=? WHERE Id=?", after, status, now, productId);
      await insertRow(tx, "TonKho_LichSu", {
        SanPhamId: productId,
        TenSanPham: String(product.TenSanPham ?? ""),
        LoaiThayDoi: changeType,
        SoLuong: quantity,
        TonKhoTruoc: before,
        TonKhoSau: after,
        GhiChu: nullableText(body, "GhiChu"),
        NguoiThucHien: staffName(user),
        DonHangId: null,
        NgayTao: now,
      });
      return { id: productId, tenSanPham: String(product.TenSanPham ?? ""), tonKho: after, tonKhoTruoc: before, tonKhoSau: after };
    });
  }

  @Get("history")
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query("sanPhamId") rawProductId?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    permission(user, "inventory.history");
    const { page, pageSize, offset } = pageValues(rawPage, rawPageSize, 50);
    const productId = rawProductId ? Number(rawProductId) : undefined;
    if (rawProductId && (!Number.isSafeInteger(productId) || Number(productId) <= 0)) throw new BadRequestException({ error: "sanPhamId không hợp lệ." });
    const where = productId ? "WHERE SanPhamId=?" : "";
    const params = productId ? [productId] : [];
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(`SELECT COUNT(*) AS total FROM TonKho_LichSu ${where}`, ...params);
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT Id, SanPhamId, TenSanPham, LoaiThayDoi, SoLuong, TonKhoTruoc, TonKhoSau,
              GhiChu, NguoiThucHien, DonHangId, NgayTao
       FROM TonKho_LichSu ${where} ORDER BY NgayTao DESC LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    );
    return { items: jsonRows(rows), total: Number(totals[0]?.total ?? 0), page, pageSize };
  }
}

@Controller("api/admin/orders")
@UseGuards(JwtAuthGuard)
export class AdminOrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    permission(user, "orders.view");
    const { page, pageSize, offset } = pageValues(rawPage, rawPageSize);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (status?.trim()) { clauses.push("TrangThai=?"); params.push(status.trim()); }
    if (search?.trim()) {
      clauses.push("(MaDonHang LIKE ? OR TenNguoiNhan LIKE ? OR SoDienThoai LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(`SELECT COUNT(*) AS total FROM DonHang ${where}`, ...params);
    const rawOrders = await this.prisma.$queryRawUnsafe<JsonRecord[]>(`SELECT * FROM DonHang ${where} ORDER BY NgayTao DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const items: JsonRecord[] = [];
    for (const raw of rawOrders) {
      const item = jsonValue(raw) as JsonRecord;
      item.chiTiet = jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietDonHang WHERE DonHangId=? ORDER BY Id", Number(raw.Id)));
      items.push(item);
    }
    return { items, total: Number(totals[0]?.total ?? 0), page, pageSize };
  }

  @Get("stats")
  async stats(@CurrentUser() user: AuthenticatedUser) {
    permission(user, "orders.view");
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN TrangThai='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN TrangThai='confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN TrangThai='shipping' THEN 1 ELSE 0 END) AS shipping,
        SUM(CASE WHEN TrangThai='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN TrangThai='cancelled' THEN 1 ELSE 0 END) AS cancelled,
        COALESCE(SUM(CASE WHEN TrangThai='completed' THEN TongTien ELSE 0 END),0) AS revenue
       FROM DonHang`,
    );
    return jsonValue(rows[0] ?? {});
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    permission(user, "orders.view");
    return orderWithRelations(this.prisma, intPath(rawId));
  }

  @Put(":id/status")
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: JsonRecord,
  ) {
    permission(user, "orders.update_status");
    const id = intPath(rawId);
    const nextStatus = text(body, "TrangThai");
    const adminNote = nullableText(body, "GhiChuAdmin");
    if (!nextStatus) throw new BadRequestException({ error: "TrangThai không được để trống." });

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM DonHang WHERE Id=? LIMIT 1 FOR UPDATE", id);
      if (!rows[0]) throw new NotFoundException();
      const order = rows[0];
      const previous = String(order.TrangThai ?? "");
      const now = new Date();

      if (nextStatus === "cancelled" && previous !== "cancelled") {
        const details = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietDonHang WHERE DonHangId=? ORDER BY SanPhamId, Id", id);
        for (const item of details) {
          const productId = Number(item.SanPhamId);
          const quantity = Number(item.SoLuong ?? 0);
          await tx.$queryRawUnsafe<JsonRecord[]>("SELECT Id FROM SanPham WHERE Id=? LIMIT 1 FOR UPDATE", productId);
          await tx.$executeRawUnsafe(
            `UPDATE SanPham
             SET TonKho=TonKho+?, SoLuongDaBan=GREATEST(0, SoLuongDaBan-?),
                 TrangThai=CASE WHEN TrangThai='out-of-stock' THEN 'active' ELSE TrangThai END,
                 NgayCapNhat=?
             WHERE Id=?`,
            quantity,
            quantity,
            now,
            productId,
          );
          const size = String(item.KichCo ?? "");
          const color = String(item.MauSac ?? "");
          const variants = await tx.$queryRawUnsafe<JsonRecord[]>(
            "SELECT Id FROM TonKhoBienThe WHERE SanPhamId=? AND KichCo=? AND MauSac=? LIMIT 1 FOR UPDATE",
            productId,
            size,
            color,
          );
          if (variants[0]) {
            await tx.$executeRawUnsafe(
              "UPDATE TonKhoBienThe SET SoLuong=SoLuong+?, SoLuongDaBan=GREATEST(0, SoLuongDaBan-?), NgayCapNhat=? WHERE Id=?",
              quantity,
              quantity,
              now,
              Number(variants[0].Id),
            );
          }
        }
        const couponCode = String(order.MaGiamGia ?? "").trim();
        if (couponCode) {
          await tx.$queryRawUnsafe<JsonRecord[]>("SELECT Id FROM MaGiamGia WHERE MaCoupon=? LIMIT 1 FOR UPDATE", couponCode);
          await tx.$executeRawUnsafe("UPDATE MaGiamGia SET DaSuDung=GREATEST(0, DaSuDung-1) WHERE MaCoupon=?", couponCode);
        }
      }

      await tx.$executeRawUnsafe("UPDATE DonHang SET TrangThai=?, GhiChuAdmin=?, NgayCapNhat=? WHERE Id=?", nextStatus, adminNote, now, id);
      if (nextStatus === "confirmed") await tx.$executeRawUnsafe("UPDATE DonHang SET NgayXacNhan=? WHERE Id=?", now, id);
      if (nextStatus === "shipping") await tx.$executeRawUnsafe("UPDATE DonHang SET NgayGiaoHang=? WHERE Id=?", now, id);
      if (nextStatus === "completed") await tx.$executeRawUnsafe("UPDATE DonHang SET NgayHoanThanh=? WHERE Id=?", now, id);
      return orderWithRelations(tx, id);
    });
  }
}

@Controller("api/admin/variant-stock")
@UseGuards(JwtAuthGuard)
export class AdminVariantStockController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(
    @CurrentUser() user: AuthenticatedUser,
    @Query("sanPhamId") rawProductId?: string,
    @Query("search") search?: string,
    @Query("lowStock") rawLowStock?: string,
    @Query("threshold") rawThreshold = "5",
  ) {
    permission(user, "inventory.view");
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (rawProductId) {
      const productId = Number(rawProductId);
      if (!Number.isSafeInteger(productId) || productId <= 0) throw new BadRequestException({ error: "sanPhamId không hợp lệ." });
      clauses.push("v.SanPhamId=?"); params.push(productId);
    }
    if (search?.trim()) {
      clauses.push("(p.TenSanPham LIKE ? OR p.MaSanPham LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (rawLowStock?.toLowerCase() === "true") {
      const threshold = Math.max(0, Number(rawThreshold) || 5);
      clauses.push("v.SoLuong<=?"); params.push(threshold);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT v.Id, v.SanPhamId, p.TenSanPham, p.HinhAnh, p.MaSanPham,
              v.KichCo, v.MauSac, v.SoLuong, v.SoLuongDaBan, v.GiaVonTrungBinh, v.NgayCapNhat
       FROM TonKhoBienThe v JOIN SanPham p ON p.Id=v.SanPhamId
       ${where} ORDER BY v.SoLuong`,
      ...params,
    ));
  }

  @Get("by-product/:sanPhamId")
  async byProduct(@CurrentUser() user: AuthenticatedUser, @Param("sanPhamId") rawProductId: string) {
    permission(user, "inventory.view");
    const productId = intPath(rawProductId);
    const products = await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM SanPham WHERE Id=? LIMIT 1", productId);
    if (!products[0]) throw new NotFoundException();
    const variants = jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT v.Id, v.SanPhamId, p.TenSanPham, p.HinhAnh, p.MaSanPham,
              v.KichCo, v.MauSac, v.SoLuong, v.SoLuongDaBan, v.GiaVonTrungBinh, v.NgayCapNhat
       FROM TonKhoBienThe v JOIN SanPham p ON p.Id=v.SanPhamId
       WHERE v.SanPhamId=? ORDER BY v.MauSac, v.KichCo`,
      productId,
    ));
    return {
      sanPhamId: productId,
      tenSanPham: String(products[0].TenSanPham ?? ""),
      tonKhoTong: Number(products[0].TonKho ?? 0),
      tongTuBienThe: variants.reduce((sum, item) => sum + Number(item.soLuong ?? 0), 0),
      soBienThe: variants.length,
      variants,
    };
  }

  @Put(":id")
  async adjust(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string, @Body() body: JsonRecord) {
    permission(user, "inventory.manage");
    const id = intPath(rawId);
    const newQuantity = num(body, "SoLuong", -1);
    if (!Number.isSafeInteger(newQuantity) || newQuantity < 0) throw new BadRequestException({ error: "Số lượng không được âm." });

    return this.prisma.$transaction(async (tx) => {
      const variants = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM TonKhoBienThe WHERE Id=? LIMIT 1 FOR UPDATE", id);
      if (!variants[0]) throw new NotFoundException();
      const variant = variants[0];
      const productId = Number(variant.SanPhamId);
      const products = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM SanPham WHERE Id=? LIMIT 1 FOR UPDATE", productId);
      if (!products[0]) throw new NotFoundException({ error: "Sản phẩm không tồn tại." });
      const product = products[0];
      const oldQuantity = Number(variant.SoLuong ?? 0);
      const diff = newQuantity - oldQuantity;
      const productBefore = Number(product.TonKho ?? 0);
      const productAfter = floorAtZero(productBefore + diff);
      const currentStatus = String(product.TrangThai ?? "active");
      const status = productAfter === 0 ? "out-of-stock" : currentStatus === "out-of-stock" ? "active" : currentStatus;
      const now = new Date();
      await tx.$executeRawUnsafe("UPDATE TonKhoBienThe SET SoLuong=?, NgayCapNhat=? WHERE Id=?", newQuantity, now, id);
      await tx.$executeRawUnsafe("UPDATE SanPham SET TonKho=?, TrangThai=?, NgayCapNhat=? WHERE Id=?", productAfter, status, now, productId);
      const reason = nullableText(body, "LyDo");
      const note = `Điều chỉnh kiểm kê - Size ${String(variant.KichCo ?? "")} / Màu ${String(variant.MauSac ?? "")}: ${oldQuantity} → ${newQuantity}${reason ? ` - Lý do: ${reason}` : ""}`;
      await insertRow(tx, "TonKho_LichSu", {
        SanPhamId: productId,
        TenSanPham: String(product.TenSanPham ?? ""),
        LoaiThayDoi: "set",
        SoLuong: Math.abs(diff),
        TonKhoTruoc: productBefore,
        TonKhoSau: productAfter,
        GhiChu: note,
        NguoiThucHien: staffName(user),
        DonHangId: null,
        NgayTao: now,
      });
      return { id, sanPhamId: productId, kichCo: variant.KichCo, mauSac: variant.MauSac, soLuong: newQuantity, tonKhoTongMoi: productAfter };
    });
  }
}

@Controller("api/admin/stock-receipts")
@UseGuards(JwtAuthGuard, AdminStaffGuard)
export class AdminStockReceiptsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all(
    @Query("search") search?: string,
    @Query("supplierId") rawSupplierId?: string,
    @Query("fromDate") rawFrom?: string,
    @Query("toDate") rawTo?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    const { page, pageSize, offset } = pageValues(rawPage, rawPageSize);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (search?.trim()) {
      clauses.push("(p.MaPhieu LIKE ? OR p.TenNhaCungCap LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (rawSupplierId) {
      const supplierId = Number(rawSupplierId);
      if (!Number.isSafeInteger(supplierId) || supplierId <= 0) throw new BadRequestException({ error: "supplierId không hợp lệ." });
      clauses.push("p.NhaCungCapId=?"); params.push(supplierId);
    }
    const fromDate = parseOptionalDate(rawFrom, "fromDate");
    const toDate = parseOptionalDate(rawTo, "toDate");
    if (fromDate) { clauses.push("p.NgayNhap>=?"); params.push(fromDate); }
    if (toDate) { clauses.push("p.NgayNhap<=?"); params.push(toDate); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totals = await this.prisma.$queryRawUnsafe<Array<{ total: unknown }>>(`SELECT COUNT(*) AS total FROM PhieuNhap p ${where}`, ...params);
    const rows = await this.prisma.$queryRawUnsafe<JsonRecord[]>(
      `SELECT p.Id, p.MaPhieu, p.NhaCungCapId, p.TenNhaCungCap, p.NgayNhap, p.NguoiNhap,
              p.TongGiaTri, p.GhiChu, p.TrangThai, p.NgayTao,
              (SELECT COUNT(*) FROM ChiTietPhieuNhap c WHERE c.PhieuNhapId=p.Id) AS SoLuongDong,
              COALESCE((SELECT SUM(c.SoLuong) FROM ChiTietPhieuNhap c WHERE c.PhieuNhapId=p.Id),0) AS TongSoLuong
       FROM PhieuNhap p ${where} ORDER BY p.NgayNhap DESC LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    );
    return { items: jsonRows(rows), total: Number(totals[0]?.total ?? 0), page, pageSize };
  }

  @Get(":id")
  async one(@Param("id") rawId: string) {
    const id = intPath(rawId);
    const receipts = await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM PhieuNhap WHERE Id=? LIMIT 1", id);
    if (!receipts[0]) throw new NotFoundException();
    const result = jsonValue(receipts[0]) as JsonRecord;
    result.chiTiet = jsonRows(await this.prisma.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietPhieuNhap WHERE PhieuNhapId=? ORDER BY Id", id));
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: JsonRecord) {
    const rawItems = bodyValue(body, "Items");
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new BadRequestException({ error: "Phiếu nhập phải có ít nhất 1 dòng sản phẩm." });
    const items = rawItems as JsonRecord[];
    for (const item of items) {
      const quantity = num(item, "SoLuong", -1);
      const cost = num(item, "DonGiaNhap", -1);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new BadRequestException({ error: "Số lượng mỗi dòng phải lớn hơn 0." });
      if (!Number.isFinite(cost) || cost < 0) throw new BadRequestException({ error: "Đơn giá nhập không được âm." });
      if (cost === 0) throw new BadRequestException({ error: "Đơn giá nhập không được bằng 0. Vui lòng nhập giá nhập hàng." });
    }

    return this.prisma.$transaction(async (tx) => {
      const supplierId = nullableNum(body, "NhaCungCapId");
      let supplierName = nullableText(body, "TenNhaCungCap")?.trim() || null;
      if (supplierId !== null) {
        const suppliers = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM NhaCungCap WHERE Id=? LIMIT 1 FOR UPDATE", supplierId);
        if (!suppliers[0]) throw new BadRequestException({ error: "Nhà cung cấp không tồn tại." });
        supplierName = String(suppliers[0].TenNhaCungCap ?? "");
      }

      const productIds = [...new Set(items.map((item) => num(item, "SanPhamId")))].sort((a, b) => a - b);
      if (productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new BadRequestException({ error: "SanPhamId không hợp lệ." });
      const products = new Map<number, JsonRecord>();
      for (const productId of productIds) {
        const rows = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM SanPham WHERE Id=? LIMIT 1 FOR UPDATE", productId);
        if (!rows[0]) throw new BadRequestException({ error: `Sản phẩm không tồn tại: ${productId}` });
        products.set(productId, rows[0]);
      }

      const now = new Date();
      const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
      const prefix = `NHAP-${stamp}`;
      const todayRows = await tx.$queryRawUnsafe<Array<{ MaPhieu: unknown }>>("SELECT MaPhieu FROM PhieuNhap WHERE MaPhieu LIKE ? FOR UPDATE", `${prefix}-%`);
      let maxSuffix = 0;
      for (const row of todayRows) {
        const suffix = Number(String(row.MaPhieu ?? "").split("-").at(-1));
        if (Number.isSafeInteger(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
      }
      const receiptCode = `${prefix}-${String(maxSuffix + 1).padStart(3, "0")}`;
      const receiptDateRaw = bodyValue(body, "NgayNhap");
      const receiptDate = receiptDateRaw === undefined || receiptDateRaw === null || receiptDateRaw === "" ? now : new Date(String(receiptDateRaw));
      if (Number.isNaN(receiptDate.getTime())) throw new BadRequestException({ error: "NgayNhap không hợp lệ." });
      const importer = text(body, "NguoiNhap").trim() || staffName(user);
      const receiptId = await insertRow(tx, "PhieuNhap", {
        MaPhieu: receiptCode,
        NhaCungCapId: supplierId,
        TenNhaCungCap: supplierName,
        NgayNhap: receiptDate,
        NguoiNhap: importer,
        TongGiaTri: 0,
        GhiChu: nullableText(body, "GhiChu"),
        TrangThai: "done",
        NgayTao: now,
        NgayCapNhat: null,
      });

      let totalValue = 0;
      for (const item of items) {
        const productId = num(item, "SanPhamId");
        const product = products.get(productId)!;
        const quantity = num(item, "SoLuong");
        const cost = num(item, "DonGiaNhap");
        const lineTotal = quantity * cost;
        totalValue += lineTotal;
        const size = nullableText(item, "KichCo")?.trim() || null;
        const color = nullableText(item, "MauSac")?.trim() || null;
        await insertRow(tx, "ChiTietPhieuNhap", {
          PhieuNhapId: receiptId,
          SanPhamId: productId,
          TenSanPham: String(product.TenSanPham ?? ""),
          KichCo: size,
          MauSac: color,
          SoLuong: quantity,
          DonGiaNhap: cost,
          ThanhTien: lineTotal,
          GhiChu: nullableText(item, "GhiChu"),
        });

        if (size && color) {
          const variants = await tx.$queryRawUnsafe<JsonRecord[]>(
            "SELECT * FROM TonKhoBienThe WHERE SanPhamId=? AND KichCo=? AND MauSac=? LIMIT 1 FOR UPDATE",
            productId,
            size,
            color,
          );
          if (variants[0]) {
            const oldQuantity = Number(variants[0].SoLuong ?? 0);
            const oldCost = variants[0].GiaVonTrungBinh === null || variants[0].GiaVonTrungBinh === undefined ? cost : Number(variants[0].GiaVonTrungBinh);
            const newQuantity = oldQuantity + quantity;
            const averageCost = weightedAverageCost(oldQuantity, oldCost, quantity, cost);
            await tx.$executeRawUnsafe("UPDATE TonKhoBienThe SET SoLuong=?, GiaVonTrungBinh=?, NgayCapNhat=? WHERE Id=?", newQuantity, averageCost, now, Number(variants[0].Id));
          } else {
            await insertRow(tx, "TonKhoBienThe", {
              SanPhamId: productId,
              KichCo: size,
              MauSac: color,
              SoLuong: quantity,
              SoLuongDaBan: 0,
              GiaVonTrungBinh: cost,
              NgayTao: now,
              NgayCapNhat: null,
            });
          }
        }

        const stockBefore = Number(product.TonKho ?? 0);
        const stockAfter = stockBefore + quantity;
        const currentStatus = String(product.TrangThai ?? "active");
        const status = currentStatus === "out-of-stock" ? "active" : currentStatus;
        await tx.$executeRawUnsafe("UPDATE SanPham SET TonKho=?, TrangThai=?, NgayCapNhat=? WHERE Id=?", stockAfter, status, now, productId);
        product.TonKho = stockAfter;
        product.TrangThai = status;
        const variantNote = `${size ? ` - Size ${size}` : ""}${color ? ` / Màu ${color}` : ""}`;
        await insertRow(tx, "TonKho_LichSu", {
          SanPhamId: productId,
          TenSanPham: String(product.TenSanPham ?? ""),
          LoaiThayDoi: "import",
          SoLuong: quantity,
          TonKhoTruoc: stockBefore,
          TonKhoSau: stockAfter,
          GhiChu: `Phiếu nhập ${receiptCode}${variantNote}`,
          NguoiThucHien: staffName(user),
          DonHangId: null,
          NgayTao: now,
        });
      }

      await tx.$executeRawUnsafe("UPDATE PhieuNhap SET TongGiaTri=? WHERE Id=?", totalValue, receiptId);
      return { id: receiptId, maPhieu: receiptCode, tongGiaTri: totalValue, ngayNhap: receiptDate, soLuongDong: items.length };
    });
  }

  @Post(":id/cancel")
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body?: JsonRecord,
  ) {
    const id = intPath(rawId);
    const payload = body ?? {};
    const reason = nullableText(payload, "LyDo")?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const receipts = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM PhieuNhap WHERE Id=? LIMIT 1 FOR UPDATE", id);
      if (!receipts[0]) throw new NotFoundException();
      const receipt = receipts[0];
      if (String(receipt.TrangThai ?? "") === "cancelled") throw new BadRequestException({ error: "Phiếu này đã bị hủy." });
      const details = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM ChiTietPhieuNhap WHERE PhieuNhapId=? ORDER BY SanPhamId, Id", id);
      const now = new Date();
      for (const detail of details) {
        const productId = Number(detail.SanPhamId);
        const quantity = Number(detail.SoLuong ?? 0);
        const products = await tx.$queryRawUnsafe<JsonRecord[]>("SELECT * FROM SanPham WHERE Id=? LIMIT 1 FOR UPDATE", productId);
        if (!products[0]) continue;
        const product = products[0];
        const before = Number(product.TonKho ?? 0);
        const after = floorAtZero(before - quantity);
        const status = after === 0 ? "out-of-stock" : String(product.TrangThai ?? "active");
        await tx.$executeRawUnsafe("UPDATE SanPham SET TonKho=?, TrangThai=?, NgayCapNhat=? WHERE Id=?", after, status, now, productId);

        const size = String(detail.KichCo ?? "").trim();
        const color = String(detail.MauSac ?? "").trim();
        if (size && color) {
          const variants = await tx.$queryRawUnsafe<JsonRecord[]>(
            "SELECT * FROM TonKhoBienThe WHERE SanPhamId=? AND KichCo=? AND MauSac=? LIMIT 1 FOR UPDATE",
            productId,
            size,
            color,
          );
          if (variants[0]) {
            const variantAfter = floorAtZero(Number(variants[0].SoLuong ?? 0) - quantity);
            await tx.$executeRawUnsafe("UPDATE TonKhoBienThe SET SoLuong=?, NgayCapNhat=? WHERE Id=?", variantAfter, now, Number(variants[0].Id));
          }
        }

        await insertRow(tx, "TonKho_LichSu", {
          SanPhamId: productId,
          TenSanPham: String(product.TenSanPham ?? ""),
          LoaiThayDoi: "export",
          SoLuong: quantity,
          TonKhoTruoc: before,
          TonKhoSau: after,
          GhiChu: `Hủy phiếu nhập ${String(receipt.MaPhieu ?? "")}${reason ? ` - Lý do: ${reason}` : ""}`,
          NguoiThucHien: staffName(user),
          DonHangId: null,
          NgayTao: now,
        });
      }
      const oldNote = String(receipt.GhiChu ?? "").trim();
      const cancelNote = `[Đã hủy]${reason ? ` ${reason}` : ""}`;
      const note = oldNote ? `${oldNote}\n${cancelNote}` : cancelNote;
      await tx.$executeRawUnsafe("UPDATE PhieuNhap SET TrangThai='cancelled', NgayCapNhat=?, GhiChu=? WHERE Id=?", now, note, id);
      return { message: "Đã hủy phiếu nhập và rollback tồn kho.", maPhieu: String(receipt.MaPhieu ?? "") };
    });
  }
}
