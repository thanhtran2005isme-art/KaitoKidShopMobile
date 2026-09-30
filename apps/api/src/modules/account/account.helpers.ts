export function resolveNextTier(current: string): {
  nextTier: string;
  threshold: number;
} {
  switch (current) {
    case "Member": return { nextTier: "Silver", threshold: 2_000_000 };
    case "Silver": return { nextTier: "Gold", threshold: 5_000_000 };
    case "Gold": return { nextTier: "Diamond", threshold: 10_000_000 };
    default: return { nextTier: "Diamond", threshold: 10_000_000 };
  }
}

export function normalizePhone(raw: string): string | null {
  const phone = raw.trim();
  if (phone.length === 0) return null;
  const digits = [...phone].filter((char) => /\d/.test(char)).join("");
  if (digits.length < 9 || digits.length > 12) {
    throw new Error("Số điện thoại cần có từ 9 đến 12 chữ số.");
  }
  return phone;
}

export function utcDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày sinh không hợp lệ.");
  const today = new Date();
  const candidate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (candidate > current) throw new Error("Ngày sinh không thể nằm trong tương lai.");
  return new Date(candidate).toISOString().slice(0, 10);
}
