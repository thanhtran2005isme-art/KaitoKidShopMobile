import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toBoolean, toNumber } from "../../common/db-value.js";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: number, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const [totalRows, unreadRows, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
        "SELECT COUNT(*) AS count FROM ThongBao WHERE NguoiDungId = ?",
        userId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
        "SELECT COUNT(*) AS count FROM ThongBao WHERE NguoiDungId = ? AND DaDoc = 0",
        userId,
      ),
      this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT Id AS id, TieuDe AS title, NoiDung AS body, LoaiThongBao AS type,
                DaDoc AS isRead, LienKet AS link, NgayTao AS createdAt
         FROM ThongBao
         WHERE NguoiDungId = ?
         ORDER BY NgayTao DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        userId,
      ),
    ]);

    return {
      total: toNumber(totalRows[0]?.count),
      unread: toNumber(unreadRows[0]?.count),
      items: rows.map((row) => ({
        id: toNumber(row.id),
        title: row.title,
        body: row.body,
        type: row.type,
        isRead: toBoolean(row.isRead),
        link: row.link,
        createdAt: row.createdAt,
      })),
    };
  }

  async unreadCount(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
      "SELECT COUNT(*) AS count FROM ThongBao WHERE NguoiDungId = ? AND DaDoc = 0",
      userId,
    );
    return { unread: toNumber(rows[0]?.count) };
  }

  async markRead(userId: number, id: number): Promise<boolean> {
    const affected = await this.prisma.$executeRawUnsafe(
      "UPDATE ThongBao SET DaDoc = 1 WHERE Id = ? AND NguoiDungId = ?",
      id,
      userId,
    );
    return affected > 0;
  }

  async markAllRead(userId: number) {
    const updated = await this.prisma.$executeRawUnsafe(
      "UPDATE ThongBao SET DaDoc = 1 WHERE NguoiDungId = ? AND DaDoc = 0",
      userId,
    );
    return { updated };
  }

  async remove(userId: number, id: number): Promise<boolean> {
    const affected = await this.prisma.$executeRawUnsafe(
      "DELETE FROM ThongBao WHERE Id = ? AND NguoiDungId = ?",
      id,
      userId,
    );
    return affected > 0;
  }
}
