import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface BannerRow {
  id: unknown;
  title: string;
  subtitle: string | null;
  description: string | null;
  image: string;
  link: string | null;
  secondLink: string | null;
  primaryButton: string | null;
  secondaryButton: string | null;
  type: string;
  position: string;
  sortOrder: unknown;
}

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(position: string, type?: string) {
    const now = new Date();
    const typeFilter = type ? " AND LoaiBanner = ?" : "";
    const params: any[] = [position, now, now];
    if (type) params.push(type);

    const rows = await this.prisma.$queryRawUnsafe<BannerRow[]>(
      `SELECT
         Id AS id, TieuDe AS title, TieuDePhu AS subtitle, MoTa AS description,
         HinhAnh AS image, LienKet AS link, LinkPhu AS secondLink,
         NutChinh AS primaryButton, NutPhu AS secondaryButton,
         LoaiBanner AS type, ViTri AS position, ThuTu AS sortOrder
       FROM Banner
       WHERE TrangThai = 'active'
         AND ViTri = ?
         AND (NgayBatDau IS NULL OR NgayBatDau <= ?)
         AND (NgayKetThuc IS NULL OR NgayKetThuc >= ?)
         ${typeFilter}
       ORDER BY ThuTu`,
      ...params,
    );

    return rows.map((row) => ({
      ...row,
      id: toNumber(row.id),
      sortOrder: toNumber(row.sortOrder),
    }));
  }
}
