import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { toBoolean, toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { hashPassword } from "./password.js";

interface StaffListRow {
  id: unknown;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  roleId: unknown;
  roleName: string;
  roleCode: string;
  superAdmin: unknown;
  active: unknown;
  locked: unknown;
  lastLogin: Date | string | null;
  startDate: Date | string | null;
  createdAt: Date | string;
}

interface StaffDetailRow extends StaffListRow {
  birthDate: Date | string | null;
  gender: string | null;
  address: string | null;
  failedAttempts: unknown;
  note: string | null;
}

interface RoleRow {
  id: unknown;
  code: string;
  name: string;
  description: string | null;
  isDefault: unknown;
  active: unknown;
}

interface PermissionRow {
  id: unknown;
  code: string;
  name: string;
  group: string;
  description: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function positiveInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function optionalDate(
  value: unknown,
  field: string,
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      error: `${field} không hợp lệ.`,
    });
  }
  return date;
}

function distinctIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isSafeInteger(item) && item > 0),
  )];
}

@Injectable()
export class StaffManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    search: string | undefined,
    roleId: number | null,
    active: boolean | null,
  ) {
    const where: string[] = [];
    const values: unknown[] = [];

    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      where.push(
        "(n.Email LIKE ? OR n.HoTen LIKE ? OR n.SoDienThoai LIKE ?)",
      );
      values.push(pattern, pattern, pattern);
    }
    if (roleId !== null) {
      where.push("n.VaiTroId = ?");
      values.push(roleId);
    }
    if (active !== null) {
      where.push("n.TrangThai = ?");
      values.push(active ? 1 : 0);
    }

    const rows = await this.prisma.$queryRawUnsafe<StaffListRow[]>(
      `${this.staffListSelect()}
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY n.NgayTao DESC`,
      ...values,
    );
    return rows.map((row) => this.mapList(row));
  }

  async getById(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<StaffDetailRow[]>(
      `${this.staffDetailSelect()}
       WHERE n.Id = ?
       LIMIT 1`,
      id,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException();
    return {
      ...this.mapList(row),
      ngaySinh: row.birthDate,
      gioiTinh: row.gender,
      diaChi: row.address,
      soLanDangNhapSai: toNumber(row.failedAttempts),
      ghiChu: row.note,
    };
  }

  async create(body: Record<string, unknown>) {
    const email = text(body.email).toLowerCase();
    const password =
      typeof body.password === "string" ? body.password : "";
    const name = text(body.hoTen);
    const roleId = positiveInt(body.vaiTroId);

    if (!email || !password || !name) {
      throw new BadRequestException({
        error:
          "Email, mật khẩu và họ tên không được để trống.",
      });
    }
    if (password.length < 6) {
      throw new BadRequestException({
        error: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }
    if (!roleId) {
      throw new BadRequestException({
        error: "Vai trò không tồn tại.",
      });
    }

    const hash = await hashPassword(password);
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM NhanVien WHERE LOWER(Email) = ? LIMIT 1 FOR UPDATE",
        email,
      );
      if (exists[0]) {
        throw new BadRequestException({
          error: "Email đã được sử dụng.",
        });
      }

      const role = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM VaiTro WHERE Id = ? LIMIT 1 FOR UPDATE",
        roleId,
      );
      if (!role[0]) {
        throw new BadRequestException({
          error: "Vai trò không tồn tại.",
        });
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO NhanVien
           (Email, MatKhauHash, HoTen, SoDienThoai, AnhDaiDien,
            VaiTroId, NgaySinh, GioiTinh, DiaChi, NgayVaoLam,
            TrangThai, GhiChu, NgayTao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        email,
        hash,
        name,
        text(body.soDienThoai) || null,
        text(body.anhDaiDien) || null,
        roleId,
        optionalDate(body.ngaySinh, "Ngày sinh"),
        text(body.gioiTinh) || null,
        text(body.diaChi) || null,
        optionalDate(body.ngayVaoLam, "Ngày vào làm") ?? new Date(),
        boolValue(body.trangThai, true) ? 1 : 0,
        text(body.ghiChu) || null,
        new Date(),
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      return {
        id: toNumber(ids[0]?.id),
        email,
        hoTen: name,
        vaiTroId: roleId,
        trangThai: boolValue(body.trangThai, true),
      };
    });
  }

  async update(
    currentUserId: number,
    callerSuperAdmin: boolean,
    id: number,
    body: Record<string, unknown>,
  ) {
    const roleId = positiveInt(body.vaiTroId);
    const active = boolValue(body.trangThai, true);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        id: unknown;
        superAdmin: unknown;
      }>>(
        `SELECT Id AS id, LaSuperAdmin AS superAdmin
         FROM NhanVien
         WHERE Id = ?
         LIMIT 1
         FOR UPDATE`,
        id,
      );
      const staff = rows[0];
      if (!staff) throw new NotFoundException();

      if (id === currentUserId && !active) {
        throw new BadRequestException({
          error:
            "Không thể tự khóa tài khoản của chính bạn.",
        });
      }

      const role = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM VaiTro WHERE Id = ? LIMIT 1",
        roleId,
      );
      if (!role[0]) {
        throw new BadRequestException({
          error: "Vai trò không tồn tại.",
        });
      }
      if (toBoolean(staff.superAdmin) && !callerSuperAdmin) {
        throw new ForbiddenException();
      }

      const name = text(body.hoTen);
      await tx.$executeRawUnsafe(
        `UPDATE NhanVien
         SET HoTen = ?, SoDienThoai = ?, AnhDaiDien = ?,
             VaiTroId = ?, NgaySinh = ?, GioiTinh = ?,
             DiaChi = ?, NgayVaoLam = ?, TrangThai = ?,
             GhiChu = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        name,
        text(body.soDienThoai) || null,
        text(body.anhDaiDien) || null,
        roleId,
        optionalDate(body.ngaySinh, "Ngày sinh"),
        text(body.gioiTinh) || null,
        text(body.diaChi) || null,
        optionalDate(body.ngayVaoLam, "Ngày vào làm"),
        active ? 1 : 0,
        text(body.ghiChu) || null,
        new Date(),
        id,
      );
      return { id, hoTen: name, vaiTroId: roleId };
    });
  }

  async resetPassword(id: number, newPassword: string) {
    if (!newPassword.trim() || newPassword.length < 6) {
      throw new BadRequestException({
        error: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }
    const hash = await hashPassword(newPassword);
    const affected = await this.prisma.$executeRawUnsafe(
      `UPDATE NhanVien
       SET MatKhauHash = ?, SoLanDangNhapSai = 0,
           BiKhoa = 0, NgayCapNhat = ?
       WHERE Id = ?`,
      hash,
      new Date(),
      id,
    );
    if (affected === 0) throw new NotFoundException();
    return { message: "Đã đặt lại mật khẩu." };
  }

  async unlock(id: number) {
    const affected = await this.prisma.$executeRawUnsafe(
      `UPDATE NhanVien
       SET BiKhoa = 0, SoLanDangNhapSai = 0,
           NgayCapNhat = ?
       WHERE Id = ?`,
      new Date(),
      id,
    );
    if (affected === 0) throw new NotFoundException();
    return { message: "Đã mở khóa tài khoản." };
  }

  async softDelete(currentUserId: number, id: number) {
    if (id === currentUserId) {
      throw new BadRequestException({
        error:
          "Không thể xóa tài khoản của chính bạn.",
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        superAdmin: unknown;
      }>>(
        `SELECT LaSuperAdmin AS superAdmin
         FROM NhanVien
         WHERE Id = ?
         LIMIT 1
         FOR UPDATE`,
        id,
      );
      if (!rows[0]) throw new NotFoundException();
      if (toBoolean(rows[0].superAdmin)) {
        throw new BadRequestException({
          error:
            "Không thể xóa tài khoản Super Admin.",
        });
      }
      await tx.$executeRawUnsafe(
        `UPDATE NhanVien
         SET TrangThai = 0, NgayCapNhat = ?
         WHERE Id = ?`,
        new Date(),
        id,
      );
      return {
        message:
          "Đã chuyển nhân viên sang trạng thái ngừng hoạt động.",
      };
    });
  }

  async roles() {
    const roles = await this.prisma.$queryRawUnsafe<RoleRow[]>(
      `SELECT Id AS id, MaVaiTro AS code, TenVaiTro AS name,
              MoTa AS description, LaMacDinh AS isDefault,
              TrangThai AS active
       FROM VaiTro
       ORDER BY Id`,
    );
    const mappings = await this.prisma.$queryRawUnsafe<Array<{
      roleId: unknown;
      permissionId: unknown;
    }>>(
      `SELECT VaiTroId AS roleId, QuyenHanId AS permissionId
       FROM VaiTro_QuyenHan
       ORDER BY VaiTroId, QuyenHanId`,
    );
    const counts = await this.prisma.$queryRawUnsafe<Array<{
      roleId: unknown;
      count: unknown;
    }>>(
      `SELECT VaiTroId AS roleId, COUNT(*) AS count
       FROM NhanVien
       GROUP BY VaiTroId`,
    );

    return roles.map((role) => {
      const id = toNumber(role.id);
      return {
        id,
        maVaiTro: role.code,
        tenVaiTro: role.name,
        moTa: role.description,
        laMacDinh: toBoolean(role.isDefault),
        trangThai: toBoolean(role.active),
        soNhanVien:
          toNumber(
            counts.find((item) => toNumber(item.roleId) === id)
              ?.count,
          ),
        quyenHanIds: mappings
          .filter((item) => toNumber(item.roleId) === id)
          .map((item) => toNumber(item.permissionId)),
      };
    });
  }

  async createRole(body: Record<string, unknown>) {
    const code = text(body.maVaiTro).toLowerCase();
    const name = text(body.tenVaiTro);
    if (!code || !name) {
      throw new BadRequestException({
        error:
          "Mã vai trò và tên không được để trống.",
      });
    }

    const permissionIds = distinctIds(body.quyenHanIds);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM VaiTro WHERE LOWER(MaVaiTro) = ? LIMIT 1 FOR UPDATE",
        code,
      );
      if (existing[0]) {
        throw new BadRequestException({
          error: "Mã vai trò đã tồn tại.",
        });
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO VaiTro
           (MaVaiTro, TenVaiTro, MoTa, TrangThai,
            LaMacDinh, NgayTao)
         VALUES (?, ?, ?, ?, 0, ?)`,
        code,
        name,
        text(body.moTa) || null,
        boolValue(body.trangThai, true) ? 1 : 0,
        new Date(),
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      const roleId = toNumber(ids[0]?.id);
      await this.replaceRolePermissions(
        tx,
        roleId,
        permissionIds,
      );
      return { id: roleId, maVaiTro: code };
    });
  }

  async updateRole(
    id: number,
    body: Record<string, unknown>,
  ) {
    const incomingCode = text(body.maVaiTro).toLowerCase();
    const name = text(body.tenVaiTro);
    const permissionIds = distinctIds(body.quyenHanIds);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<RoleRow[]>(
        `SELECT Id AS id, MaVaiTro AS code, TenVaiTro AS name,
                MoTa AS description, LaMacDinh AS isDefault,
                TrangThai AS active
         FROM VaiTro
         WHERE Id = ?
         LIMIT 1
         FOR UPDATE`,
        id,
      );
      const role = rows[0];
      if (!role) throw new NotFoundException();

      if (
        toBoolean(role.isDefault) &&
        role.code !== incomingCode
      ) {
        throw new BadRequestException({
          error:
            "Không thể đổi mã của vai trò mặc định.",
        });
      }

      await tx.$executeRawUnsafe(
        `UPDATE VaiTro
         SET TenVaiTro = ?, MoTa = ?, TrangThai = ?,
             NgayCapNhat = ?
         WHERE Id = ?`,
        name,
        text(body.moTa) || null,
        boolValue(body.trangThai, true) ? 1 : 0,
        new Date(),
        id,
      );
      await this.replaceRolePermissions(
        tx,
        id,
        permissionIds,
      );
      return { id, tenVaiTro: name };
    });
  }

  async deleteRole(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<RoleRow[]>(
        `SELECT Id AS id, MaVaiTro AS code, TenVaiTro AS name,
                MoTa AS description, LaMacDinh AS isDefault,
                TrangThai AS active
         FROM VaiTro
         WHERE Id = ?
         LIMIT 1
         FOR UPDATE`,
        id,
      );
      const role = rows[0];
      if (!role) throw new NotFoundException();
      if (toBoolean(role.isDefault)) {
        throw new BadRequestException({
          error:
            "Không thể xóa vai trò mặc định của hệ thống.",
        });
      }

      const inUse = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM NhanVien WHERE VaiTroId = ? LIMIT 1",
        id,
      );
      if (inUse[0]) {
        throw new BadRequestException({
          error:
            "Vai trò đang được gán cho nhân viên — không thể xóa.",
        });
      }

      await tx.$executeRawUnsafe(
        "DELETE FROM VaiTro_QuyenHan WHERE VaiTroId = ?",
        id,
      );
      await tx.$executeRawUnsafe(
        "DELETE FROM VaiTro WHERE Id = ?",
        id,
      );
    });
  }

  async permissions() {
    const rows = await this.prisma.$queryRawUnsafe<PermissionRow[]>(
      `SELECT Id AS id, MaQuyen AS code,
              TenQuyen AS name, Nhom AS \`group\`,
              MoTa AS description
       FROM QuyenHan
       ORDER BY Nhom, MaQuyen`,
    );
    return rows.map((row) => ({
      id: toNumber(row.id),
      maQuyen: row.code,
      tenQuyen: row.name,
      nhom: row.group,
      moTa: row.description,
    }));
  }

  private async replaceRolePermissions(
    tx: {
      $executeRawUnsafe(
        query: string,
        ...values: any[]
      ): Promise<number>;
    },
    roleId: number,
    permissionIds: number[],
  ) {
    await tx.$executeRawUnsafe(
      "DELETE FROM VaiTro_QuyenHan WHERE VaiTroId = ?",
      roleId,
    );
    for (const permissionId of permissionIds) {
      await tx.$executeRawUnsafe(
        `INSERT INTO VaiTro_QuyenHan
           (VaiTroId, QuyenHanId)
         VALUES (?, ?)`,
        roleId,
        permissionId,
      );
    }
  }

  private mapList(row: StaffListRow) {
    return {
      id: toNumber(row.id),
      email: row.email,
      hoTen: row.name,
      soDienThoai: row.phone,
      anhDaiDien: row.avatar,
      vaiTroId: toNumber(row.roleId),
      tenVaiTro: row.roleName,
      maVaiTro: row.roleCode,
      laSuperAdmin: toBoolean(row.superAdmin),
      trangThai: toBoolean(row.active),
      biKhoa: toBoolean(row.locked),
      lanDangNhapCuoi: row.lastLogin,
      ngayVaoLam: row.startDate,
      ngayTao: row.createdAt,
    };
  }

  private staffListSelect(): string {
    return `SELECT
      n.Id AS id, n.Email AS email, n.HoTen AS name,
      n.SoDienThoai AS phone, n.AnhDaiDien AS avatar,
      n.VaiTroId AS roleId, v.TenVaiTro AS roleName,
      v.MaVaiTro AS roleCode, n.LaSuperAdmin AS superAdmin,
      n.TrangThai AS active, n.BiKhoa AS locked,
      n.LanDangNhapCuoi AS lastLogin,
      n.NgayVaoLam AS startDate, n.NgayTao AS createdAt
    FROM NhanVien n
    JOIN VaiTro v ON v.Id = n.VaiTroId`;
  }

  private staffDetailSelect(): string {
    return `SELECT
      n.Id AS id, n.Email AS email, n.HoTen AS name,
      n.SoDienThoai AS phone, n.AnhDaiDien AS avatar,
      n.VaiTroId AS roleId, v.TenVaiTro AS roleName,
      v.MaVaiTro AS roleCode, n.LaSuperAdmin AS superAdmin,
      n.TrangThai AS active, n.BiKhoa AS locked,
      n.LanDangNhapCuoi AS lastLogin,
      n.NgayVaoLam AS startDate, n.NgayTao AS createdAt,
      n.NgaySinh AS birthDate, n.GioiTinh AS gender,
      n.DiaChi AS address,
      n.SoLanDangNhapSai AS failedAttempts,
      n.GhiChu AS note
    FROM NhanVien n
    JOIN VaiTro v ON v.Id = n.VaiTroId`;
  }
}
