import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 11;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
  allowPlainFallback = true,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!hash) return { valid: false, needsRehash: false };

  try {
    const valid = await bcrypt.compare(password, hash);
    if (valid) return { valid: true, needsRehash: false };

    const plain =
      allowPlainFallback &&
      !hash.startsWith("$2") &&
      password === hash;
    return { valid: plain, needsRehash: plain };
  } catch {
    const valid = allowPlainFallback && password === hash;
    return { valid, needsRehash: valid };
  }
}

export async function verifyBcryptOnly(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
