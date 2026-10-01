import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import {
  csvValues,
  queryInt,
  queryOptionalBoolean,
  queryOptionalInt,
  queryOptionalNumber,
  queryString,
  queryTrimmed,
} from "../../common/query-value.js";
import {
  mapProduct,
  mapProductDetail,
  ProductRow,
  ReviewRow,
  VariantInventoryRow,
} from "./product.mapper.js";
import { toNumber } from "../../common/db-value.js";

const PRODUCT_LIST_SELECT = `
  SELECT
    Id AS id,
    TenSanPham AS name,
    DanhMuc AS category,
    DanhMucPhu AS subcategory,
    GioiTinh AS gender,
    Gia AS price,
    GiaCu AS oldPrice,
    TonKho AS stock,
    COALESCE(SoLuongDaGiu, 0) AS reserved,
    TrangThai AS status,
    HinhAnh AS image,
    MoTaNgan AS shortDescription,
    MaSanPham AS sku,
    Slug AS slug,
    LaSanPhamMoi AS isNew,
    DangGiamGia AS isSale,
    BanChayNhat AS isBestSeller,
    DiemDanhGia AS rating,
    SoLuongDaBan AS soldCount,
    DanhSachMau AS colors,
    DanhSachSize AS sizes
  FROM SanPham
`;

const PRODUCT_DETAIL_SELECT = `
  SELECT
    Id AS id,
    TenSanPham AS name,
    DanhMuc AS category,
    DanhMucPhu AS subcategory,
    PhongCach AS style,
    NhomTuoi AS ageGroup,
    GioiTinh AS gender,
    Gia AS price,
    GiaCu AS oldPrice,
    TonKho AS stock,
    COALESCE(SoLuongDaGiu, 0) AS reserved,
    TrangThai AS status,
    HinhAnh AS image,
    DanhSachAnh AS images,
    MoTaNgan AS shortDescription,
    MoTaChiTiet AS description,
    MaSanPham AS sku,
    Slug AS slug,
    Menu AS menu,
    BoSuuTapId AS collectionId,
    ThongSoKyThuat AS specs,
    LaSanPhamMoi AS isNew,
    DangGiamGia AS isSale,
    BanChayNhat AS isBestSeller,
    DiemDanhGia AS rating,
    SoLuongDaBan AS soldCount,
    DanhSachMau AS colors,
    DanhSachSize AS sizes,
    BienThe AS variants,
    NgayTao AS createdAt
  FROM SanPham
`;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: Record<string, unknown>) {
    const where = ["TrangThai = 'active'"];
    const params: any[] = [];

    const equal = (column: string, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      where.push(`${column} = ?`);
      params.push(value);
    };

    equal("BoSuuTapId", queryOptionalInt(query.collectionId, "collectionId"));
    equal("DanhMuc", queryTrimmed(query.category));
    equal("DanhMucPhu", queryTrimmed(query.subcategory));
    equal("GioiTinh", queryTrimmed(query.gender));
    equal("PhongCach", queryTrimmed(query.style));
    equal("NhomTuoi", queryTrimmed(query.ageGroup));

    const search = queryTrimmed(query.search);
    if (search) {
      where.push("(TenSanPham LIKE ? OR MoTaChiTiet LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const minPrice = queryOptionalNumber(query.minPrice, "minPrice");
    if (minPrice !== undefined) {
      where.push("Gia >= ?");
      params.push(minPrice);
    }

    const maxPrice = queryOptionalNumber(query.maxPrice, "maxPrice");
    if (maxPrice !== undefined) {
      where.push("Gia <= ?");
      params.push(maxPrice);
    }

    const minRating = queryOptionalNumber(query.minRating, "minRating");
    if (minRating !== undefined) {
      where.push("DiemDanhGia >= ?");
      params.push(minRating);
    }

    this.addJsonAnyFilter(where, params, "DanhSachSize", csvValues(query.sizes));
    this.addJsonAnyFilter(where, params, "DanhSachMau", csvValues(query.colors));

    if (queryOptionalBoolean(query.isNew, "isNew") === true) where.push("LaSanPhamMoi = 1");
    if (queryOptionalBoolean(query.isSale, "isSale") === true) where.push("DangGiamGia = 1");
    if (queryOptionalBoolean(query.isBestSeller, "isBestSeller") === true) where.push("BanChayNhat = 1");

    const page = queryInt(query.page, 1, "page");
    const pageSize = queryInt(query.pageSize, 20, "pageSize");
    if (page < 1 || pageSize < 1) {
      throw new BadRequestException("page và pageSize phải lớn hơn 0");
    }

    const orderBy = this.orderBy(queryString(query.sortBy));
    const whereSql = where.join(" AND ");
    const countRows = await this.prisma.$queryRawUnsafe<Array<{ totalCount: unknown }>>(
      `SELECT COUNT(*) AS totalCount FROM SanPham WHERE ${whereSql}`,
      ...params,
    );
    const totalCount = toNumber(countRows[0]?.totalCount);

    const offset = (page - 1) * pageSize;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_LIST_SELECT}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ${pageSize} OFFSET ${offset}`,
      ...params,
    );

    return {
      items: rows.map(mapProduct),
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async getById(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_DETAIL_SELECT}
       WHERE Id = ? AND TrangThai IN ('active', 'out-of-stock')
       LIMIT 1`,
      id,
    );
    return rows[0] ? this.loadDetail(rows[0]) : null;
  }

  async getBySlug(slug: string) {
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_DETAIL_SELECT}
       WHERE Slug = ? AND TrangThai IN ('active', 'out-of-stock')
       LIMIT 1`,
      slug,
    );
    return rows[0] ? this.loadDetail(rows[0]) : null;
  }

  async getNewArrivals(count: number) {
    return this.listBy(
      "TrangThai = 'active' AND LaSanPhamMoi = 1",
      "NgayTao DESC",
      count,
    );
  }

  async getBestSellers(count: number) {
    return this.listBy(
      "TrangThai = 'active' AND BanChayNhat = 1",
      "SoLuongDaBan DESC",
      count,
    );
  }

  async getSaleProducts(count: number) {
    return this.listBy(
      "TrangThai = 'active' AND DangGiamGia = 1",
      "(GiaCu - Gia) DESC",
      count,
    );
  }

  async getRelated(productId: number, count: number) {
    const source = await this.prisma.$queryRawUnsafe<Array<{ category: string }>>(
      "SELECT DanhMuc AS category FROM SanPham WHERE Id = ? LIMIT 1",
      productId,
    );
    if (!source[0]) return [];

    const safeCount = Math.max(0, count);
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_LIST_SELECT}
       WHERE TrangThai = 'active' AND Id <> ? AND DanhMuc = ?
       ORDER BY SoLuongDaBan DESC
       LIMIT ${safeCount}`,
      productId,
      source[0].category,
    );
    return rows.map(mapProduct);
  }

  private async listBy(whereSql: string, orderBy: string, count: number) {
    const safeCount = Math.max(0, count);
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_LIST_SELECT}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ${safeCount}`,
    );
    return rows.map(mapProduct);
  }

  private async loadDetail(product: ProductRow) {
    const id = toNumber(product.id);
    const [inventory, reviews] = await Promise.all([
      this.prisma.$queryRawUnsafe<VariantInventoryRow[]>(
        `SELECT
           KichCo AS size,
           MauSac AS color,
           SoLuong AS stock,
           COALESCE(SoLuongDaGiu, 0) AS reserved
         FROM TonKhoBienThe
         WHERE SanPhamId = ?
         ORDER BY KichCo, MauSac`,
        id,
      ),
      this.prisma.$queryRawUnsafe<ReviewRow[]>(
        `SELECT
           Id AS id,
           SanPhamId AS productId,
           TenKhachHang AS customerName,
           SoSao AS rating,
           NoiDung AS comment,
           NgayTao AS createdAt,
           DonHangId AS orderId,
           DanhSachAnh AS images,
           Video AS videoUrl,
           KichCo AS size,
           MauSac AS color,
           PhanHoiAdmin AS adminReply,
           NgayPhanHoi AS repliedAt,
           COALESCE(LuotHuuIch, 0) AS helpfulCount
         FROM DanhGia
         WHERE SanPhamId = ? AND TrangThai = 'approved'
         ORDER BY NgayTao DESC`,
        id,
      ),
    ]);

    return mapProductDetail(product, inventory, reviews);
  }

  private addJsonAnyFilter(
    where: string[],
    params: any[],
    column: string,
    values: string[],
  ) {
    if (values.length === 0) return;
    where.push(`(${values.map(() => `${column} LIKE ?`).join(" OR ")})`);
    params.push(...values.map((value) => `%"${value}"%`));
  }

  private orderBy(sortBy: string | undefined): string {
    switch (sortBy) {
      case "price-asc": return "Gia ASC";
      case "price-desc": return "Gia DESC";
      case "newest": return "NgayTao DESC";
      case "bestseller": return "SoLuongDaBan DESC";
      case "rating": return "DiemDanhGia DESC";
      default: return "Id DESC";
    }
  }
}
