import { cookies } from "next/headers";
import type { UserBaseRole } from "@/types/domain";

export const SESSION_COOKIE_NAME = "ct_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  fullName: string;
  baseRole: UserBaseRole;
  isSuperadmin: boolean;
  exp: number;
}

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "creative-team-dev-secret-change-in-prod"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSessionToken(
  payload: Omit<SessionPayload, "exp">
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const enc = new TextEncoder();
  const dataBytes = enc.encode(JSON.stringify(fullPayload));
  const dataB64 = toBase64Url(dataBytes);
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${dataB64}.${sigB64}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataB64, sigB64] = parts;
  try {
    const key = await getHmacKey();
    const enc = new TextEncoder();
    const sigBytes = fromBase64Url(sigB64);
    const sigBuffer = sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength
    ) as ArrayBuffer;
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      enc.encode(dataB64)
    );
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(fromBase64Url(dataB64));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
