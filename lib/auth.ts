import type { Role, User } from "./types";
import { readDB, writeDB, isCloudMode } from "./store";
import { authVerifyLogin, authCreateUser, supabaseConfigured, type AppProfile } from "./supabase";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Session tokens live in an edge-safe module (middleware runs on the Edge
// runtime, which has no Node "crypto"). Re-exported here so Node-side import
// sites keep working unchanged.
export { encodeSession, decodeSession, type SessionUser } from "./session-token";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

function profileToUser(p: AppProfile): User {
  return { id: p.id, email: p.email, name: p.name, role: p.role };
}

/** Never let password hashes leave the server (API responses, HR directory). */
export function sanitizeUser(u: User): User {
  const { passwordHash: _omit, ...safe } = u;
  return safe;
}

// ------------------------------------------------------------ password hashing
// Used only for accounts created while the app runs on the local JSON store.
// Cloud accounts keep their (bcrypt) hash inside Supabase auth.users instead.

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

// -------------------------------------------------------------------- login

/**
 * Credentials are verified by Supabase Auth whenever cloud mode is active —
 * password hashes live in auth.users (bcrypt), never in app tables. Without
 * Supabase, accounts are verified against the local store: scrypt hashes for
 * accounts created through sign-up, plus the legacy demo passwords.
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  if (supabaseConfigured() && (await isCloudMode())) {
    const { profile } = await authVerifyLogin(email, password);
    if (profile) return profileToUser(profile);
    return null;
  }

  const db = await readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;

  // Account created through sign-up in local mode → scrypt hash.
  if (user.passwordHash) {
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  }

  // Pre-auth demo accounts → deterministic demo passwords.
  const expected = `demo-${user.role}`;
  if (password !== expected) return null;
  return user;
}

// ------------------------------------------------------------------ sign-up

/**
 * Register a new account. Cloud mode: through Supabase Auth (bcrypt in
 * auth.users) + profile mirrored into user_directory. Local mode: appended to
 * the JSON store with a scrypt hash, so HR/employee creation always works.
 */
export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: Role
): Promise<{ user: User | null; error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (supabaseConfigured() && (await isCloudMode())) {
    const { user, error } = await authCreateUser(normalized, password, name, role);
    if (error || !user) return { user: null, error };
    return { user: profileToUser(user) };
  }

  // Local store path.
  const db = await readDB();
  if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
    return { user: null, error: "An account with this email already exists" };
  }
  const user: User = {
    id: `u-${Math.random().toString(36).slice(2, 9)}`,
    email: normalized,
    name,
    role,
    passwordHash: await hashPassword(password),
  };
  db.users.push(user);
  await writeDB(db);
  return { user };
}
