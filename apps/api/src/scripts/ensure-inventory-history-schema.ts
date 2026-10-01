import "dotenv/config";
import { PrismaService } from "../database/prisma.service.js";

interface ColumnRow {
  columnName: unknown;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const before = await prisma.$queryRawUnsafe<ColumnRow[]>(
      `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = LOWER('TonKho_LichSu')
         AND LOWER(COLUMN_NAME) = LOWER('TenSanPham')`,
    );

    if (before.length === 0) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE TonKho_LichSu
         ADD COLUMN TenSanPham VARCHAR(200) NOT NULL DEFAULT '' AFTER SanPhamId`,
      );
    }

    await prisma.$executeRawUnsafe(
      `UPDATE TonKho_LichSu t
       JOIN SanPham p ON p.Id = t.SanPhamId
       SET t.TenSanPham = p.TenSanPham
       WHERE t.TenSanPham IS NULL OR TRIM(t.TenSanPham) = ''`,
    );

    const after = await prisma.$queryRawUnsafe<ColumnRow[]>(
      `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = LOWER('TonKho_LichSu')
         AND LOWER(COLUMN_NAME) = LOWER('TenSanPham')`,
    );

    const compatible = after.length === 1;
    console.log(
      JSON.stringify(
        {
          table: "TonKho_LichSu",
          requiredColumn: "TenSanPham",
          added: before.length === 0,
          compatible,
        },
        null,
        2,
      ),
    );

    if (!compatible) {
      throw new Error("Không thể bảo đảm TonKho_LichSu.TenSanPham cho Node Admin runtime.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
