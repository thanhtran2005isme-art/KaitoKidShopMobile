import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toBoolean, toNumber } from "../../common/db-value.js";

interface AddressInput {
  fullName?: unknown;
  phone?: unknown;
  province?: unknown;
  district?: unknown;
  ward?: unknown;
  street?: unknown;
  isDefault?: unknown;
}

interface AddressRow {
  id: unknown;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: unknown;
}

function mapAddress(row: AddressRow) {
  return {
    id: toNumber(row.id),
    fullName: row.fullName,
    phone: row.phone,
    province: row.province,
    district: row.district,
    ward: row.ward,
    street: row.street,
    isDefault: toBoolean(row.isDefault),
  };
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: number) {
    const rows = await this.prisma.$queryRawUnsafe<AddressRow[]>(
      `SELECT Id AS id, HoTen AS fullName, SoDienThoai AS phone,
              TinhThanh AS province, QuanHuyen AS district, PhuongXa AS ward,
              DiaChiCuThe AS street, LaMacDinh AS isDefault
       FROM DiaChi
       WHERE NguoiDungId = ?
       ORDER BY LaMacDinh DESC, NgayTao DESC`,
      userId,
    );
    return rows.map(mapAddress);
  }

  async create(userId: number, raw: AddressInput) {
    const input = this.normalize(raw);
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.$executeRawUnsafe(
          "UPDATE DiaChi SET LaMacDinh = 0 WHERE NguoiDungId = ? AND LaMacDinh = 1",
          userId,
        );
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO DiaChi
           (NguoiDungId, HoTen, SoDienThoai, TinhThanh, QuanHuyen, PhuongXa, DiaChiCuThe, LaMacDinh)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userId,
        input.fullName,
        input.phone,
        input.province,
        input.district,
        input.ward,
        input.street,
        input.isDefault ? 1 : 0,
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      return this.getByIdWithClient(tx, userId, toNumber(ids[0]?.id));
    });
  }

  async update(userId: number, addressId: number, raw: AddressInput) {
    const input = this.normalize(raw);
    return this.prisma.$transaction(async (tx) => {
      const exists = await this.getByIdWithClient(tx, userId, addressId);
      if (!exists) return null;

      if (input.isDefault) {
        await tx.$executeRawUnsafe(
          "UPDATE DiaChi SET LaMacDinh = 0 WHERE NguoiDungId = ? AND LaMacDinh = 1",
          userId,
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE DiaChi
         SET HoTen = ?, SoDienThoai = ?, TinhThanh = ?, QuanHuyen = ?,
             PhuongXa = ?, DiaChiCuThe = ?, LaMacDinh = ?
         WHERE Id = ? AND NguoiDungId = ?`,
        input.fullName,
        input.phone,
        input.province,
        input.district,
        input.ward,
        input.street,
        input.isDefault ? 1 : 0,
        addressId,
        userId,
      );
      return this.getByIdWithClient(tx, userId, addressId);
    });
  }

  async remove(userId: number, addressId: number): Promise<boolean> {
    const affected = await this.prisma.$executeRawUnsafe(
      "DELETE FROM DiaChi WHERE Id = ? AND NguoiDungId = ?",
      addressId,
      userId,
    );
    return affected > 0;
  }

  async setDefault(userId: number, addressId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const exists = await this.getByIdWithClient(tx, userId, addressId);
      if (!exists) return false;

      await tx.$executeRawUnsafe(
        "UPDATE DiaChi SET LaMacDinh = 0 WHERE NguoiDungId = ? AND LaMacDinh = 1",
        userId,
      );
      await tx.$executeRawUnsafe(
        "UPDATE DiaChi SET LaMacDinh = 1 WHERE Id = ? AND NguoiDungId = ?",
        addressId,
        userId,
      );
      return true;
    });
  }

  private normalize(raw: AddressInput) {
    return {
      fullName: String(raw.fullName ?? ""),
      phone: String(raw.phone ?? ""),
      province: String(raw.province ?? ""),
      district: String(raw.district ?? ""),
      ward: String(raw.ward ?? ""),
      street: String(raw.street ?? ""),
      isDefault: raw.isDefault === true,
    };
  }

  private async getByIdWithClient(client: any, userId: number, addressId: number) {
    const rows = await client.$queryRawUnsafe(
      `SELECT Id AS id, HoTen AS fullName, SoDienThoai AS phone,
              TinhThanh AS province, QuanHuyen AS district, PhuongXa AS ward,
              DiaChiCuThe AS street, LaMacDinh AS isDefault
       FROM DiaChi
       WHERE Id = ? AND NguoiDungId = ?
       LIMIT 1`,
      addressId,
      userId,
    ) as AddressRow[];
    return rows[0] ? mapAddress(rows[0]) : null;
  }
}
