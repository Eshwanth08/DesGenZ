/**
 * Edge-safe session token utilities.
 *
 * Middleware runs in the Edge runtime, which cannot use Node's "crypto" —
 * so token encode/decode/sign live here with zero Node-only imports, and
 * everything (edge + node routes) shares this module. lib/auth.ts keeps the
 * Node-only password hashing and re-exports the SessionUser type for compat.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "hr" | "employee";
}

export function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

function sign(data: string): string {
  const secret = process.env.DESGENZ_SECRET || "desgenz-dev-secret";
  // Deterministic dev signature — fine for a local, demo-grade session token.
  let h = 5381;
  const input = `${data}|${secret}`;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
