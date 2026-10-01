import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNullableNumber, toNumber } from "../../common/db-value.js";

interface LookbookRow {
  id: unknown;
  title: string;
  subtitle: string | null;
  description: string | null;
  image: string;
  link: string | null;
  videoUrl: string | null;
  season: string | null;
  style: string | null;
  sortOrder: unknown;
}

interface HotspotRow {
  id: unknown;
  productId: unknown;
  productName: string;
  productImage: string | null;
  productPrice: unknown;
  productOldPrice: unknown;
  x: unknown;
  y: unknown;
  note: string | null;
  sortOrder: unknown;
}

@Injectable()
export class LookbooksService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(season?: string, style?: string) {
    const where = ["TrangThai = 'active'"];
    const params: any[] = [];

    if (season?.trim()) {
      where.push("Season = ?");
      params.push(season.trim());
    }
    if (style?.trim()) {
      where.push("Style = ?");
      params.push(style.trim());
    }

    const rows = await this.prisma.$queryRawUnsafe<LookbookRow[]>(
      `SELECT
         Id AS id, TieuDe AS title, TieuDePhu AS subtitle, MoTa AS description,
         HinhAnh AS image, LienKet AS link, VideoUrl AS videoUrl,
         Season AS season, Style AS style, ThuTu AS sortOrder
       FROM Lookbook
       WHERE ${where.join(" AND ")}
       ORDER BY ThuTu`,
      ...params,
    );

    return Promise.all(rows.map((row) => this.mapWithHotspots(row)));
  }

  async getById(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<LookbookRow[]>(
      `SELECT
         Id AS id, TieuDe AS title, TieuDePhu AS subtitle, MoTa AS description,
         HinhAnh AS image, LienKet AS link, VideoUrl AS videoUrl,
         Season AS season, Style AS style, ThuTu AS sortOrder
       FROM Lookbook
       WHERE Id = ? AND TrangThai = 'active'
       LIMIT 1`,
      id,
    );

    return rows[0] ? this.mapWithHotspots(rows[0]) : null;
  }

  async getFilters() {
    const [seasonRows, styleRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ value: string }>>(
        `SELECT DISTINCT Season AS value
         FROM Lookbook
         WHERE TrangThai = 'active' AND Season IS NOT NULL AND Season <> ''
         ORDER BY Season`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ value: string }>>(
        `SELECT DISTINCT Style AS value
         FROM Lookbook
         WHERE TrangThai = 'active' AND Style IS NOT NULL AND Style <> ''
         ORDER BY Style`,
      ),
    ]);

    return {
      seasons: seasonRows.map((row) => row.value),
      styles: styleRows.map((row) => row.value),
    };
  }

  private async mapWithHotspots(row: LookbookRow) {
    const hotspots = await this.prisma.$queryRawUnsafe<HotspotRow[]>(
      `SELECT
         h.Id AS id,
         p.Id AS productId,
         p.TenSanPham AS productName,
         p.HinhAnh AS productImage,
         p.Gia AS productPrice,
         p.GiaCu AS productOldPrice,
         h.ToaDoX AS x,
         h.ToaDoY AS y,
         h.GhiChu AS note,
         h.ThuTu AS sortOrder
       FROM LookbookHotspot h
       JOIN SanPham p ON p.Id = h.SanPhamId
       WHERE h.LookbookId = ?
       ORDER BY h.ThuTu`,
      toNumber(row.id),
    );

    return {
      id: toNumber(row.id),
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      image: row.image,
      link: row.link,
      videoUrl: row.videoUrl,
      season: row.season,
      style: row.style,
      sortOrder: toNumber(row.sortOrder),
      hotspots: hotspots.map((hotspot) => ({
        id: toNumber(hotspot.id),
        productId: toNumber(hotspot.productId),
        productName: hotspot.productName,
        productImage: hotspot.productImage,
        productPrice: toNumber(hotspot.productPrice),
        productOldPrice: toNullableNumber(hotspot.productOldPrice),
        x: toNumber(hotspot.x),
        y: toNumber(hotspot.y),
        note: hotspot.note,
        sortOrder: toNumber(hotspot.sortOrder),
      })),
    };
  }
}
