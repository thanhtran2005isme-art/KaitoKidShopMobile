import "dotenv/config";
import { PrismaService } from "../database/prisma.service.js";
import {
  RBAC_PERMISSIONS,
  RBAC_PERMISSION_CODES,
  RBAC_ROLE_PERMISSIONS,
} from "../migration/rbac-permission-manifest.js";

interface PermissionRow {
  code: string;
}

interface RoleRow {
  id: unknown;
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    await prisma.$transaction(async (tx) => {
      for (const permission of RBAC_PERMISSIONS) {
        await tx.$executeRawUnsafe(
          `INSERT INTO QuyenHan (MaQuyen, TenQuyen, Nhom, MoTa)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             TenQuyen = VALUES(TenQuyen),
             Nhom = VALUES(Nhom),
             MoTa = VALUES(MoTa)`,
          permission.code,
          permission.name,
          permission.group,
          permission.description,
        );
      }

      for (const [roleCode, permissions] of Object.entries(
        RBAC_ROLE_PERMISSIONS,
      )) {
        const roles = await tx.$queryRawUnsafe<RoleRow[]>(
          "SELECT Id AS id FROM VaiTro WHERE MaVaiTro = ? LIMIT 1",
          roleCode,
        );
        const roleId = number(roles[0]?.id);
        if (roleId <= 0) continue;

        for (const permissionCode of permissions) {
          await tx.$executeRawUnsafe(
            `INSERT IGNORE INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
             SELECT ?, q.Id
             FROM QuyenHan q
             WHERE q.MaQuyen = ?`,
            roleId,
            permissionCode,
          );
        }
      }
    });

    const rows = await prisma.$queryRawUnsafe<PermissionRow[]>(
      "SELECT MaQuyen AS code FROM QuyenHan ORDER BY MaQuyen",
    );
    const existing = new Set(rows.map((row) => String(row.code)));
    const missing = RBAC_PERMISSION_CODES.filter((code) => !existing.has(code));

    console.log(
      JSON.stringify(
        {
          expectedPermissionCount: RBAC_PERMISSION_CODES.length,
          presentCanonicalPermissionCount:
            RBAC_PERMISSION_CODES.length - missing.length,
          missingPermissions: missing,
          compatible: missing.length === 0,
        },
        null,
        2,
      ),
    );

    if (missing.length > 0) {
      throw new Error(
        `Không thể bảo đảm RBAC canonical, còn thiếu: ${missing.join(", ")}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
