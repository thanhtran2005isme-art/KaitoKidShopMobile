import { Injectable } from "@nestjs/common";
import { parseJsonArray, toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  aggregateJsonFacet,
  didYouMeanFromNames,
  mapped,
  priceRangeFacet,
  type SearchProductRow,
} from "./search.helpers.js";

const SEARCH_SELECT = `
SELECT
  Id AS id, TenSanPham AS name, DanhMuc AS category,
  DanhMucPhu AS subcategory, GioiTinh AS gender,
  Gia AS price, GiaCu AS oldPrice, TonKho AS stock,
  COALESCE(SoLuongDaGiu,0) AS reserved, TrangThai AS status,
  HinhAnh AS image, MoTaNgan AS shortDescription,
  MoTaChiTiet AS description, MaSanPham AS sku, Slug AS slug,
  LaSanPhamMoi AS isNew, DangGiamGia AS isSale,
  BanChayNhat AS isBestSeller, DiemDanhGia AS rating,
  SoLuongDaBan AS soldCount, DanhSachMau AS colors,
  DanhSachSize AS sizes, NgayTao AS createdAt
FROM SanPham
`;

function csv(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function finite(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function matchesJson(raw: string | null, selected: string[]) {
  if (selected.length === 0) return true;
  const values = parseJsonArray<string>(raw);
  return values.some((item) => selected.includes(item));
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: Record<string, unknown>) {
    const q =
      typeof query.query === "string" ? query.query.trim() : "";
    const tokens = [...new Set(q.split(/\s+/).filter(Boolean))];
    const params: unknown[] = [];
    const where = ["TrangThai = 'active'"];

    for (const token of tokens) {
      where.push(
        "(TenSanPham LIKE ? OR MoTaChiTiet LIKE ? OR MaSanPham LIKE ?)",
      );
      const pattern = `%${token}%`;
      params.push(pattern, pattern, pattern);
    }

    // C# chỉ lấy cửa sổ 500 sản phẩm để tính facet/search in-memory.
    const sample = await this.prisma.$queryRawUnsafe<SearchProductRow[]>(
      `${SEARCH_SELECT}
       WHERE ${where.join(" AND ")}
       LIMIT 500`,
      ...params,
    );

    const category =
      typeof query.category === "string" ? query.category.trim() : "";
    const minPrice = finite(query.minPrice);
    const maxPrice = finite(query.maxPrice);
    const minRating = finite(query.minRating);
    const sizes = csv(query.sizes);
    const colors = csv(query.colors);

    const matchPrice = (row: SearchProductRow) =>
      (minPrice === null || toNumber(row.price) >= minPrice) &&
      (maxPrice === null || toNumber(row.price) <= maxPrice);
    const matchCategory = (row: SearchProductRow) =>
      !category || row.category === category;
    const matchRating = (row: SearchProductRow) =>
      minRating === null || toNumber(row.rating) >= minRating;
    const matchSizes = (row: SearchProductRow) =>
      matchesJson(row.sizes, sizes);
    const matchColors = (row: SearchProductRow) =>
      matchesJson(row.colors, colors);

    const categoryRows = sample.filter(
      (row) =>
        matchPrice(row) &&
        matchSizes(row) &&
        matchColors(row) &&
        matchRating(row),
    );
    const categoryCounts = new Map<string, number>();
    for (const row of categoryRows) {
      if (!row.category) continue;
      categoryCounts.set(
        row.category,
        (categoryCounts.get(row.category) ?? 0) + 1,
      );
    }
    const categories = Object.fromEntries(
      [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
    );

    const sizeRows = sample.filter(
      (row) =>
        matchPrice(row) &&
        matchCategory(row) &&
        matchColors(row) &&
        matchRating(row),
    );
    const colorRows = sample.filter(
      (row) =>
        matchPrice(row) &&
        matchCategory(row) &&
        matchSizes(row) &&
        matchRating(row),
    );
    const priceRows = sample.filter(
      (row) =>
        matchCategory(row) &&
        matchSizes(row) &&
        matchColors(row) &&
        matchRating(row),
    );

    let filtered = sample.filter(
      (row) =>
        matchPrice(row) &&
        matchCategory(row) &&
        matchSizes(row) &&
        matchColors(row) &&
        matchRating(row),
    );

    const sortBy =
      typeof query.sortBy === "string" ? query.sortBy : "";
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return toNumber(a.price) - toNumber(b.price);
        case "price-desc":
          return toNumber(b.price) - toNumber(a.price);
        case "bestseller":
          return toNumber(b.soldCount) - toNumber(a.soldCount);
        case "rating":
          return toNumber(b.rating) - toNumber(a.rating);
        default:
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          );
      }
    });

    const pageRaw = Number(query.page ?? 1);
    const pageSizeRaw = Number(query.pageSize ?? 24);
    const page =
      Number.isSafeInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize =
      Number.isSafeInteger(pageSizeRaw)
        ? Math.max(1, Math.min(100, pageSizeRaw))
        : 24;
    const total = filtered.length;
    const items = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map(mapped);

    let didYouMean: string | null = null;
    if (total === 0 && q.length >= 3) {
      const names = await this.prisma.$queryRawUnsafe<
        Array<{ name: string }>
      >(
        `SELECT TenSanPham AS name
         FROM SanPham
         WHERE TrangThai = 'active'
         ORDER BY SoLuongDaBan DESC
         LIMIT 500`,
      );
      didYouMean = didYouMeanFromNames(
        q,
        names.map((item) => item.name),
      );
    }

    return {
      items,
      total,
      page,
      pageSize,
      facets: {
        categories,
        sizes: aggregateJsonFacet(sizeRows, "sizes"),
        colors: aggregateJsonFacet(colorRows, "colors"),
        priceRanges: priceRangeFacet(priceRows),
      },
      didYouMean,
    };
  }

  async suggestions(raw: string, limitRaw: number) {
    const q = raw.trim();
    if (q.length < 2) return { suggestions: [], products: [] };
    const limit = Math.max(1, Math.min(20, limitRaw || 6));
    const tokens = [...new Set(q.split(/\s+/).filter(Boolean))];
    const where = ["TrangThai = 'active'"];
    const params: unknown[] = [];
    for (const token of tokens) {
      where.push("(TenSanPham LIKE ? OR MaSanPham LIKE ?)");
      const pattern = `%${token}%`;
      params.push(pattern, pattern);
    }
    const rows = await this.prisma.$queryRawUnsafe<SearchProductRow[]>(
      `${SEARCH_SELECT}
       WHERE ${where.join(" AND ")}
       ORDER BY SoLuongDaBan DESC
       LIMIT ${limit}`,
      ...params,
    );
    return {
      suggestions: [...new Set(rows.map((row) => row.name))].slice(
        0,
        limit,
      ),
      products: rows.map(mapped),
    };
  }
}
