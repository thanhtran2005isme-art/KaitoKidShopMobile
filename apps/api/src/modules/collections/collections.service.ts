import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface CollectionRow {
  id: unknown;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  sortOrder: unknown;
}

function mapCollection(row: CollectionRow) {
  return {
    id: toNumber(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.image,
    sortOrder: toNumber(row.sortOrder),
  };
}

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.$queryRawUnsafe<CollectionRow[]>(
      `SELECT Id AS id, TenBoSuuTap AS name, Slug AS slug, MoTa AS description,
              HinhAnh AS image, ThuTu AS sortOrder
       FROM BoSuuTap
       WHERE TrangThai = 1
       ORDER BY ThuTu`,
    );
    return rows.map(mapCollection);
  }

  async getById(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<CollectionRow[]>(
      `SELECT Id AS id, TenBoSuuTap AS name, Slug AS slug, MoTa AS description,
              HinhAnh AS image, ThuTu AS sortOrder
       FROM BoSuuTap
       WHERE Id = ? AND TrangThai = 1
       LIMIT 1`,
      id,
    );
    return rows[0] ? mapCollection(rows[0]) : null;
  }
}
