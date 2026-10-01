import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PrismaService } from "../dist/database/prisma.service.js";

function ciKey(source, name) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const target = name.toLowerCase();
  return Object.keys(source).find((key) => key.toLowerCase() === target) ?? null;
}

function ciValue(source, name) {
  const key = ciKey(source, name);
  return key ? source[key] : undefined;
}

function setCi(source, name, value) {
  const key = ciKey(source, name) ?? name;
  source[key] = value;
}

function textCi(source, name) {
  const value = ciValue(source, name);
  return typeof value === "string" ? value.trim() : "";
}

function fixtureConfigFrom(originalValue) {
  let config = {};
  if (originalValue?.trim()) {
    try {
      const parsed = JSON.parse(originalValue);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        config = parsed;
      }
    } catch {
      config = {};
    }
  }

  const existingBranches = ciValue(config, "KaitoKidBranches");
  const branches = Array.isArray(existingBranches) ? existingBranches : [];
  const withoutOldFixture = branches.filter(
    (item) => textCi(item, "Code").toLowerCase() !== "phase11-race",
  );
  withoutOldFixture.push({
    Code: "phase11-race",
    Name: "Phase 11 Race Fixture",
    Province: "Phase 11 Race Province",
    District: "Race District",
    Address: "Phase 11 Race Address",
    Phone: "0000000000",
    Active: true,
  });

  setCi(config, "MockEnabled", true);
  setCi(config, "MockOnlyServeBranches", true);
  setCi(config, "KaitoKidBranches", withoutOldFixture);
  return JSON.stringify(config);
}

function quotedIdentifier(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsafe DB column name in metadata: ${name}`);
  return `\`${name}\``;
}

function firstEnumValue(columnType) {
  const match = /^enum\((.*)\)$/i.exec(columnType ?? "");
  if (!match) return "";
  const first = /^'((?:''|[^'])*)'/.exec(match[1]);
  return first ? first[1].replaceAll("''", "'") : "";
}

function requiredFallback(column) {
  const dataType = String(column.dataType ?? "").toLowerCase();
  const columnType = String(column.columnType ?? "");
  if (dataType === "enum") return firstEnumValue(columnType);
  if (["tinyint", "smallint", "mediumint", "int", "integer", "bigint", "decimal", "numeric", "float", "double", "real", "bit", "year"].includes(dataType)) return 0;
  if (["date", "datetime", "timestamp"].includes(dataType)) return new Date();
  if (dataType === "time") return "00:00:00";
  if (dataType === "json") return "{}";
  if (["binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob"].includes(dataType)) return Buffer.alloc(0);
  return "";
}

async function insertTemporaryShippingConfig(prisma, fixtureValue) {
  const columns = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CauHinhCuaHang'
     ORDER BY ORDINAL_POSITION`,
  );
  assert.ok(columns.length > 0, "Khong doc duoc schema CauHinhCuaHang tu INFORMATION_SCHEMA.");

  const valuesByName = new Map([
    ["nhomcauhinh", "shipping"], ["macauhinh", "config"], ["giatri", fixtureValue],
    ["tencauhinh", "Phase 11 Race Fixture"], ["mota", "Temporary Phase 11 concurrency fixture"],
    ["loaidulieu", "json"], ["kieudulieu", "json"], ["trangthai", 1], ["kichhoat", 1],
    ["danghoatdong", 1], ["hieuluc", 1], ["ngaytao", new Date()], ["createdat", new Date()],
    ["ngaycapnhat", new Date()], ["updatedat", new Date()],
  ]);

  const insertColumns = [];
  const insertValues = [];
  for (const column of columns) {
    const name = String(column.name);
    const lower = name.toLowerCase();
    const extra = String(column.extra ?? "").toLowerCase();
    if (extra.includes("auto_increment") || extra.includes("generated")) continue;
    if (valuesByName.has(lower)) {
      insertColumns.push(name);
      insertValues.push(valuesByName.get(lower));
      continue;
    }
    const required = String(column.isNullable).toUpperCase() === "NO" && column.defaultValue == null;
    if (required) {
      insertColumns.push(name);
      insertValues.push(requiredFallback(column));
    }
  }

  for (const requiredName of ["NhomCauHinh", "MaCauHinh", "GiaTri"]) {
    assert.ok(insertColumns.some((name) => name.toLowerCase() === requiredName.toLowerCase()), `Schema CauHinhCuaHang thieu cot ${requiredName}.`);
  }
  const sql = `INSERT INTO CauHinhCuaHang (${insertColumns.map(quotedIdentifier).join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`;
  const inserted = await prisma.$executeRawUnsafe(sql, ...insertValues);
  assert.equal(inserted, 1, "Khong tao duoc temporary shipping/config fixture row.");
}

async function installShippingFixture(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT GiaTri AS value FROM CauHinhCuaHang
     WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 1`,
  );
  const existed = Boolean(rows[0]);
  const originalValue = existed ? rows[0].value == null ? "" : String(rows[0].value) : null;
  const fixtureValue = fixtureConfigFrom(originalValue ?? "");
  if (existed) {
    const changed = await prisma.$executeRawUnsafe(
      `UPDATE CauHinhCuaHang SET GiaTri = ? WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'`, fixtureValue,
    );
    assert.ok(changed >= 1, "Khong cai duoc shipping fixture cho race gate.");
  } else {
    await insertTemporaryShippingConfig(prisma, fixtureValue);
  }
  const installed = await prisma.$queryRawUnsafe(
    `SELECT GiaTri AS value FROM CauHinhCuaHang
     WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 2`,
  );
  assert.equal(installed.length, 1, "Shipping fixture phai co dung mot row shipping/config.");
  assert.equal(String(installed[0].value ?? ""), fixtureValue, "Shipping fixture value khong khop gia tri vua cai.");
  return { existed, originalValue };
}

async function restoreShippingFixture(prisma, snapshot) {
  if (snapshot.existed) {
    const changed = await prisma.$executeRawUnsafe(
      `UPDATE CauHinhCuaHang SET GiaTri = ? WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'`, snapshot.originalValue,
    );
    assert.ok(changed >= 1, "Khong restore duoc shipping config sau race gate.");
    const rows = await prisma.$queryRawUnsafe(
      `SELECT GiaTri AS value FROM CauHinhCuaHang
       WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 1`,
    );
    const restored = rows[0]?.value == null ? "" : String(rows[0].value);
    assert.equal(restored, snapshot.originalValue, "Shipping config sau cleanup khong khop snapshot ban dau.");
    return;
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM CauHinhCuaHang WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'`,
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS found FROM CauHinhCuaHang
     WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config' LIMIT 1`,
  );
  assert.equal(rows.length, 0, "Shipping config ban dau khong ton tai; cleanup phai tra DB ve 0 row.");
}

const prisma = new PrismaService();
await prisma.$connect();
let snapshot;
let fixtureInstalled = false;
let childStatus = 1;
try {
  snapshot = await installShippingFixture(prisma);
  fixtureInstalled = true;
  console.log(snapshot.existed ? "[FIXTURE] Installed isolated mock shipping branch over existing config." : "[FIXTURE] Created temporary shipping/config row for isolated mock branch.");
  const testFiles = [
    "test/concurrency-runtime-race.test.mjs",
    "test/payment-terminal-runtime-race.test.mjs",
    "test/admin-concurrency-runtime-race.test.mjs",
  ];
  childStatus = 0;
  for (const testFile of testFiles) {
    console.log(`[RACE] Running ${testFile}`);
    const child = spawnSync(process.execPath, ["--test", testFile], {
      cwd: process.cwd(), env: process.env, stdio: "inherit",
    });
    if (child.error) throw child.error;
    childStatus = child.status ?? 1;
    if (childStatus !== 0) break;
  }
} finally {
  if (fixtureInstalled) {
    await restoreShippingFixture(prisma, snapshot);
    console.log(snapshot.existed ? "[FIXTURE] Restored original shipping config exactly." : "[FIXTURE] Removed temporary shipping/config row; original absence restored.");
  }
  await prisma.$disconnect();
}
process.exitCode = childStatus;
