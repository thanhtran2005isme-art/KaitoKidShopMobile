import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { SqlClient } from "../../common/sql-client.js";

export type JsonRecord = Record<string, unknown>;

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value[0].toLowerCase() + value.slice(1);
}

export function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    const maybeNumber = value as { toNumber?: () => number; toJSON?: () => unknown };
    if (typeof maybeNumber.toNumber === "function") {
      return maybeNumber.toNumber();
    }
    if (Buffer.isBuffer(value)) return value.toString("utf8");
    const result: JsonRecord = {};
    for (const [key, item] of Object.entries(value)) {
      result[lowerFirst(key)] = jsonValue(item);
    }
    return result;
  }
  return value;
}

export function jsonRows(rows: unknown[]): JsonRecord[] {
  return rows.map((row) => jsonValue(row) as JsonRecord);
}

export function bodyValue(body: JsonRecord, key: string): unknown {
  const target = key.toLowerCase();
  return Object.entries(body).find(([name]) => name.toLowerCase() === target)?.[1];
}

export function text(body: JsonRecord, key: string, fallback = ""): string {
  const value = bodyValue(body, key);
  return typeof value === "string" ? value : fallback;
}

export function nullableText(body: JsonRecord, key: string): string | null {
  const value = bodyValue(body, key);
  if (value === null || value === undefined) return null;
  return String(value);
}

export function num(body: JsonRecord, key: string, fallback = 0): number {
  const value = Number(bodyValue(body, key));
  return Number.isFinite(value) ? value : fallback;
}

export function nullableNum(body: JsonRecord, key: string): number | null {
  const raw = bodyValue(body, key);
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function bool(body: JsonRecord, key: string, fallback = false): boolean {
  const value = bodyValue(body, key);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (/^(true|1)$/i.test(value)) return true;
    if (/^(false|0)$/i.test(value)) return false;
  }
  return fallback;
}

export function date(body: JsonRecord, key: string, fallback: Date | null = null): Date | null {
  const raw = bodyValue(body, key);
  if (raw === null || raw === undefined || raw === "") return fallback;
  const value = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(value.getTime()) ? fallback : value;
}

export function intPath(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException({ error: "Id không hợp lệ." });
  }
  return parsed;
}

export function pageValues(rawPage?: string, rawPageSize?: string, defaultSize = 20) {
  const parsedPage = Number(rawPage ?? 1);
  const parsedSize = Number(rawPageSize ?? defaultSize);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = Number.isSafeInteger(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, 200) : defaultSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function ident(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error("Unsafe SQL identifier");
  return `\`${value}\``;
}

export async function selectById(client: SqlClient, table: string, id: number): Promise<JsonRecord> {
  const rows = await client.$queryRawUnsafe<JsonRecord[]>(
    `SELECT * FROM ${ident(table)} WHERE Id=? LIMIT 1`,
    id,
  );
  if (!rows[0]) throw new NotFoundException();
  return jsonValue(rows[0]) as JsonRecord;
}

export async function insertRow(
  client: SqlClient,
  table: string,
  values: Record<string, unknown>,
): Promise<number> {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new BadRequestException({ error: "Dữ liệu trống." });
  const columns = entries.map(([name]) => ident(name)).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  await client.$executeRawUnsafe(
    `INSERT INTO ${ident(table)} (${columns}) VALUES (${placeholders})`,
    ...entries.map(([, value]) => value),
  );
  const ids = await client.$queryRawUnsafe<Array<{ id: unknown }>>("SELECT LAST_INSERT_ID() AS id");
  return Number(ids[0]?.id ?? 0);
}

export async function updateRow(
  client: SqlClient,
  table: string,
  id: number,
  values: Record<string, unknown>,
): Promise<JsonRecord> {
  await selectById(client, table, id);
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (entries.length > 0) {
    const set = entries.map(([name]) => `${ident(name)}=?`).join(", ");
    await client.$executeRawUnsafe(
      `UPDATE ${ident(table)} SET ${set} WHERE Id=?`,
      ...entries.map(([, value]) => value),
      id,
    );
  }
  return selectById(client, table, id);
}

export async function deleteRow(client: SqlClient, table: string, id: number): Promise<void> {
  await selectById(client, table, id);
  await client.$executeRawUnsafe(`DELETE FROM ${ident(table)} WHERE Id=?`, id);
}

export function calculateAdjustedStock(
  before: number,
  quantity: number,
  changeType: "import" | "export" | "set",
): number {
  if (!Number.isSafeInteger(before) || before < 0) throw new Error("before must be a non-negative integer");
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("quantity must be a non-negative integer");
  if (changeType === "import") return before + quantity;
  if (changeType === "set") return quantity;
  if (quantity > before) throw new Error("insufficient stock");
  return before - quantity;
}

export function weightedAverageCost(
  oldQuantity: number,
  oldCost: number,
  incomingQuantity: number,
  incomingCost: number,
): number {
  const totalQuantity = oldQuantity + incomingQuantity;
  if (totalQuantity <= 0) return incomingCost;
  return (oldCost * oldQuantity + incomingCost * incomingQuantity) / totalQuantity;
}

export function floorAtZero(value: number): number {
  return Math.max(0, value);
}
