import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

interface CategoryRow {
  id: unknown;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  parentId: unknown;
  sortOrder: unknown;
}

function mapCategory(row: CategoryRow) {
  return {
    id: toNumber(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.image,
    parentId: row.parentId === null ? null : toNumber(row.parentId),
    sortOrder: toNumber(row.sortOrder),
  };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.$queryRawUnsafe<CategoryRow[]>(
      `SELECT Id AS id, TenDanhMuc AS name, Slug AS slug, MoTa AS description,
              HinhAnh AS image, DanhMucChaId AS parentId, ThuTu AS sortOrder
       FROM DanhMuc
       WHERE TrangThai = 1
       ORDER BY ThuTu`,
    );
    return rows.map(mapCategory);
  }

  async getById(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<CategoryRow[]>(
      `SELECT Id AS id, TenDanhMuc AS name, Slug AS slug, MoTa AS description,
              HinhAnh AS image, DanhMucChaId AS parentId, ThuTu AS sortOrder
       FROM DanhMuc
       WHERE Id = ? AND TrangThai = 1
       LIMIT 1`,
      id,
    );
    return rows[0] ? mapCategory(rows[0]) : null;
  }
}
