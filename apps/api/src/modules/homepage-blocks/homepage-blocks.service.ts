import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface HomepageBlockRow {
  id: unknown;
  type: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image: string | null;
  link: string | null;
  icon: string | null;
  sortOrder: unknown;
}

@Injectable()
export class HomepageBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async get(type?: string) {
    const hasType = Boolean(type?.trim());
    const rows = await this.prisma.$queryRawUnsafe<HomepageBlockRow[]>(
      `SELECT
         Id AS id, BlockType AS type, TieuDe AS title, TieuDePhu AS subtitle,
         MoTa AS description, HinhAnh AS image, LienKet AS link, Icon AS icon,
         ThuTu AS sortOrder
       FROM HomepageBlock
       WHERE TrangThai = 1
       ${hasType ? "AND BlockType = ?" : ""}
       ORDER BY BlockType, ThuTu`,
      ...(hasType ? [type!.trim()] : []),
    );

    const dto = rows.map((row) => ({
      ...row,
      id: toNumber(row.id),
      sortOrder: toNumber(row.sortOrder),
    }));

    if (hasType) return dto;

    return dto.reduce<Record<string, typeof dto>>((groups, item) => {
      (groups[item.type] ??= []).push(item);
      return groups;
    }, {});
  }
}
