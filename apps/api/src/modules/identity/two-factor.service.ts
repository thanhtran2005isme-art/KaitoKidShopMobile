import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "KaitoKidShop";

export function base32Encode(input: Uint8Array): string {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function base32Decode(value: string): Buffer {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");
  let bits = "";
  for (const ch of normalized) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) throw new Error("Base32 không hợp lệ");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpAt(
  secret: string,
  timeMs: number,
  stepSeconds = 30,
): string {
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now(),
): boolean {
  if (!secret.trim() || !/^\d{6}$/.test(code.trim())) return false;
  try {
    for (const drift of [-1, 0, 1]) {
      if (totpAt(secret, nowMs + drift * 30_000) === code.trim()) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

@Injectable()
export class TwoFactorService {
  generateSetup(email: string) {
    const secret = base32Encode(randomBytes(20));
    const issuer = encodeURIComponent(ISSUER);
    const account = encodeURIComponent(email);
    const otpAuthUri =
      `otpauth://totp/${issuer}:${account}` +
      `?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return { secret, otpAuthUri };
  }

  verifyCode(secret: string, code: string): boolean {
    return verifyTotp(secret, code);
  }

  generateBackupCodes(): string[] {
    return Array.from(
      { length: 8 },
      () => randomBytes(5).toString("hex"),
    );
  }
}
