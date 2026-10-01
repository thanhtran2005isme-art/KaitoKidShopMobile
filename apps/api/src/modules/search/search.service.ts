import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import { toNumber } from "../../common/db-value.js";

const PRODUCT_SELECT = `
SELECT
  Id AS id, TenSanPham AS name, DanhMuc AS category,
  DanhMucPhu AS subcategory, GioiTinh AS gender,
  Gia AS price, GiaCu AS oldPrice, TonKho AS stock,
  COALESCE(SoLuongDaGiu,0) AS reserved, TrangThai AS status,
  HinhAnh AS image, MoTaNgan AS shortDescription,
  MaSanPham AS sku, Slug AS slug,
  LaSanPhamMoi AS isNew, DangGiamGia AS isSale,
  BanChayNhat AS isBestSeller, DiemDanhGia AS rating,
  SoLuongDaBan AS soldCount, DanhSachMau AS colors,
  DanhSachSize AS sizes, NgayTao AS createdAt
FROM SanPham
`;

function csv(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(",").map((x) => x.trim()).filter(Boolean)
    : [];
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function jsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: Record<string, unknown>) {
    const q =
      typeof query.query === "string"
        ? query.query.trim()
        : typeof query.q === "string"
          ? query.q.trim()
          : "";
    const tokens = q
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    const where = ["TrangThai='active'"];
    const params: unknown[] = [];
    for (const token of tokens) {
      where.push(
        "(TenSanPham LIKE ? OR MoTaChiTiet LIKE ? OR MaSanPham LIKE ?)",
      );
      const like = `%${token}%`;
      params.push(like, like, like);
    }

    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_SELECT}
       WHERE ${where.join(" AND ")}
       ORDER BY Id DESC
       LIMIT 500`,
      ...params,
    );

    const sizes = csv(query.sizes);
    const colors = csv(query.colors);
    const minPrice = num(query.minPrice);
    const maxPrice = num(query.maxPrice);
    const minRating = num(query.minRating);
    const category =
      typeof query.category === "string" ? query.category.trim() : "";

    const matchPrice = (p: ProductRow) =>
      (minPrice === null || toNumber(p.price) >= minPrice) &&
      (maxPrice === null || toNumber(p.price) <= maxPrice);
    const matchCategory = (p: ProductRow) =>
      !category || p.category === category;
    const matchRating = (p: ProductRow) =>
      minRating === null || toNumber(p.rating) >= minRating;
    const matchSizes = (p: ProductRow) =>
      sizes.length === 0 ||
      jsonArray(p.sizes).some((s) => sizes.includes(s));
    const matchColors = (p: ProductRow) =>
      colors.length === 0 ||
      jsonArray(p.colors).some((c) => colors.includes(c));

    const categories = this.count(
      rows.filter(
        (p) =>
          matchPrice(p) &&
          matchSizes(p) &&
          matchColors(p) &&
          matchRating(p),
      ),
      (p) => [p.category],
    );
    const sizeFacet = this.count(
      rows.filter(
        (p) =>
          matchPrice(p) &&
          matchCategory(p) &&
          matchColors(p) &&
          matchRating(p),
      ),
      (p) => jsonArray(p.sizes),
    );
    const colorFacet = this.count(
      rows.filter(
        (p) =>
          matchPrice(p) &&
          matchCategory(p) &&
          matchSizes(p) &&
          matchRating(p),
      ),
      (p) => jsonArray(p.colors),
    );

    let filtered = rows.filter(
      (p) =>
        matchPrice(p) &&
        matchCategory(p) &&
        matchSizes(p) &&
        matchColors(p) &&
        matchRating(p),
    );

    const sort =
      typeof query.sortBy === "string" ? query.sortBy : "";
    filtered = [...filtered].sort((a, b) => {
      if (sort === "price-asc") return toNumber(a.price) - toNumber(b.price);
      if (sort === "price-desc") return toNumber(b.price) - toNumber(a.price);
      if (sort === "bestseller") return toNumber(b.soldCount) - toNumber(a.soldCount);
      if (sort === "rating") return toNumber(b.rating) - toNumber(a.rating);
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });

    const page = Math.max(1, Math.floor(Number(query.page ?? 1) || 1));
    const pageSize = Math.max(
      1,
      Math.min(100, Math.floor(Number(query.pageSize ?? 20) || 20)),
    );
    const items = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map(mapProduct);

    const didYouMean =
      filtered.length === 0 && q.length >= 3
        ? await this.didYouMean(q)
        : null;

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
      facets: {
        categories,
        sizes: sizeFacet,
        colors: colorFacet,
        priceRanges: this.priceRanges(
          rows.filter(
            (p) =>
              matchCategory(p) &&
              matchSizes(p) &&
              matchColors(p) &&
              matchRating(p),
          ),
        ),
      },
      didYouMean,
    };
  }

  async suggestions(q: string, limit = 6) {
    const text = q.trim();
    if (text.length < 2) return { suggestions: [], products: [] };
    const tokens = text.split(/\s+/).filter(Boolean);
    const where = ["TrangThai='active'"];
    const params: unknown[] = [];
    for (const token of tokens) {
      where.push("(TenSanPham LIKE ? OR MaSanPham LIKE ?)");
      const like = `%${token}%`;
      params.push(like, like);
    }
    const safeLimit = Math.max(1, Math.min(20, limit));
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_SELECT}
       WHERE ${where.join(" AND ")}
       ORDER BY SoLuongDaBan DESC
       LIMIT ${safeLimit}`,
      ...params,
    );
    const products = rows.map(mapProduct);
    return {
      suggestions: [...new Set(products.map((p) => p.name))].slice(
        0,
        safeLimit,
      ),
      products,
    };
  }

  private count(
    rows: ProductRow[],
    values: (row: ProductRow) => string[],
  ) {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const value of values(row)) {
        if (!value) continue;
        map.set(value, (map.get(value) ?? 0) + 1);
      }
    }
    return Object.fromEntries(
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
    );
  }

  private priceRanges(rows: ProductRow[]) {
    const ranges = [
      ["Dưới 200k", 0, 200_000],
      ["200k - 500k", 200_000, 500_000],
      ["500k - 1tr", 500_000, 1_000_000],
      ["1tr - 2tr", 1_000_000, 2_000_000],
      ["Trên 2tr", 2_000_000, Number.MAX_SAFE_INTEGER],
    ] as const;
    const result: Record<string, number> = {};
    for (const row of rows) {
      const price = toNumber(row.price);
      for (const [label, min, max] of ranges) {
        if (price >= min && price <= max) {
          result[label] = (result[label] ?? 0) + 1;
          break;
        }
      }
    }
    return result;
  }

  private async didYouMean(query: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT TenSanPham AS name
       FROM SanPham
       WHERE TrangThai='active'
       ORDER BY SoLuongDaBan DESC LIMIT 500`,
    );
    const target = query.toLowerCase();
    const threshold = Math.max(1, Math.floor(target.length / 3));
    let best: string | null = null;
    let bestDistance = Number.MAX_SAFE_INTEGER;
    for (const row of rows) {
      for (const token of row.name.toLowerCase().split(/\s+/)) {
        if (token.length < 2 || token === target) continue;
        if (Math.abs(token.length - target.length) > threshold + 1) continue;
        const d = this.levenshtein(target, token);
        if (d < bestDistance && d <= threshold) {
          bestDistance = d;
          best = token;
        }
      }
    }
    return best;
  }

  private levenshtein(a: string, b: string) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
      for (let j = 0; j < cur.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }
}

export { PRODUCT_SELECT };
