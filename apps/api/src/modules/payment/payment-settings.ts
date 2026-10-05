import type { SqlClient } from "../../common/sql-client.js";

export interface PaymentBankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string | null;
  qrImage: string | null;
}

export interface PaymentSettings {
  enableCod: boolean;
  enableBank: boolean;
  bankAccounts: PaymentBankAccount[];
}

interface SettingRow {
  code: string;
  value: string;
}

function usable(account: PaymentBankAccount): boolean {
  return Boolean(
    account.bankName.trim() &&
    account.accountNumber.trim() &&
    account.accountHolder.trim()
  );
}

function field(
  obj: Record<string, unknown>,
  name: string,
): unknown {
  const target = name.toLowerCase();
  return Object.entries(obj).find(
    ([key]) => key.toLowerCase() === target,
  )?.[1];
}

function stringField(
  obj: Record<string, unknown>,
  name: string,
): string {
  const value = field(obj, name);
  return typeof value === "string" ? value.trim() : "";
}

function readBool(
  map: Map<string, string>,
  code: string,
  fallback: boolean,
): boolean {
  const raw = map.get(code);
  if (raw === undefined) return fallback;
  if (/^true$/i.test(raw)) return true;
  if (/^false$/i.test(raw)) return false;
  return fallback;
}

function readBoolAliases(
  map: Map<string, string>,
  codes: string[],
  fallback: boolean,
): boolean {
  for (const code of codes) {
    if (map.has(code)) return readBool(map, code, fallback);
  }
  return fallback;
}

export async function loadPaymentSettings(
  client: SqlClient,
): Promise<PaymentSettings> {
  const rows = await client.$queryRawUnsafe<SettingRow[]>(
    `SELECT MaCauHinh AS code, GiaTri AS value
     FROM CauHinhCuaHang
     WHERE NhomCauHinh = 'payment'`,
  );
  const map = new Map(rows.map((row) => [row.code, row.value]));

  const accounts: PaymentBankAccount[] = [];
  const json = map.get("bankAccounts");
  if (json?.trim()) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const obj = item as Record<string, unknown>;
          const account: PaymentBankAccount = {
            id: Number(field(obj, "Id") ?? 0),
            bankName: stringField(obj, "BankName"),
            accountNumber: stringField(obj, "AccountNumber"),
            accountHolder: stringField(obj, "AccountHolder"),
            branch: stringField(obj, "Branch") || null,
            qrImage: stringField(obj, "QrImage") || null,
          };
          if (usable(account)) accounts.push(account);
        }
      }
    } catch {
      // Fallback các key payment cũ.
    }
  }

  if (accounts.length === 0) {
    const bankName = (map.get("bankName") ?? "").trim();
    const accountNumber = (map.get("bankAccount") ?? "").trim();
    const accountHolder = (map.get("bankOwner") ?? "").trim();
    if (bankName && accountNumber && accountHolder) {
      accounts.push({
        id: 1,
        bankName,
        accountNumber,
        accountHolder,
        branch: (map.get("bankBranch") ?? "").trim() || null,
        qrImage: (map.get("bankQrImage") ?? "").trim() || null,
      });
    }
  }

  return {
    // Admin Web hiện lưu codEnabled/bankEnabled; vẫn đọc alias legacy để
    // tương thích dữ liệu cũ đã tồn tại trong CauHinhCuaHang.
    enableCod: readBoolAliases(map, ["codEnabled", "enableCOD"], true),
    enableBank:
      readBoolAliases(
        map,
        ["bankEnabled", "enableBankTransfer"],
        accounts.length > 0,
      ) && accounts.length > 0,
    bankAccounts: accounts,
  };
}
