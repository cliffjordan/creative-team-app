import crypto from "crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 32;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith(`${HASH_PREFIX}$`)) {
    return false;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;

  const [, salt, originalHex] = parts;
  if (!salt || !originalHex) return false;

  try {
    const derivedBuf = crypto.scryptSync(pin, salt, KEY_LENGTH);
    const originalBuf = Buffer.from(originalHex, "hex");
    if (derivedBuf.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, originalBuf);
  } catch {
    return false;
  }
}
