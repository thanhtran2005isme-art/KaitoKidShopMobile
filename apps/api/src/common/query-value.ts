import { BadRequestException, NotFoundException } from "@nestjs/common";

function first(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export function queryString(value: unknown): string | undefined {
  return first(value);
}

export function queryTrimmed(value: unknown): string | undefined {
  const raw = first(value);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function queryInt(value: unknown, fallback: number, field: string): number {
  const raw = first(value);
  if (raw === undefined || raw === "") return fallback;
  if (!/^-?\d+$/.test(raw)) throw new BadRequestException(`${field} phải là số nguyên`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new BadRequestException(`${field} không hợp lệ`);
  return parsed;
}

export function queryOptionalInt(value: unknown, field: string): number | undefined {
  const raw = first(value);
  if (raw === undefined || raw === "") return undefined;
  return queryInt(raw, 0, field);
}

export function queryOptionalNumber(value: unknown, field: string): number | undefined {
  const raw = first(value);
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} phải là số`);
  return parsed;
}

export function queryOptionalBoolean(value: unknown, field: string): boolean | undefined {
  const raw = first(value);
  if (raw === undefined || raw === "") return undefined;
  if (/^true$/i.test(raw) || raw === "1") return true;
  if (/^false$/i.test(raw) || raw === "0") return false;
  throw new BadRequestException(`${field} phải là true hoặc false`);
}

export function pathInt(value: string): number {
  if (!/^\d+$/.test(value)) throw new NotFoundException();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new NotFoundException();
  return parsed;
}

export function csvValues(value: unknown): string[] {
  const raw = first(value) ?? "";
  return [...new Set(
    raw
      .split(",")
      .map((item) => item.trim().replaceAll('"', ""))
      .filter(Boolean),
  )];
}
