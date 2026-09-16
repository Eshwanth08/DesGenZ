/**
 * DesGenZ — Supabase Auth + data client + RBAC helpers.
 *
 * Configured via env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    (server-side only — bypasses RLS; the
 *                                 "LLM / AI Service" principal from spec §2)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (optional, client-side reads)
 *
 * AUTH: Supabase Auth is the credential source of truth. Sign-up and login go
 * through it (bcrypt hashes live in auth.users, never in app tables). App
 * metadata (name, role) is mirrored into public.user_directory, which RLS
 * policies read via public.app_role(). When Supabase is not configured the app
 * falls back to the legacy demo-password login against the JSON store.
 *
 * RLS (supabase/supabase-setup.sql, spec §2):
 *   HR        → full access to people-data tables, read-only on projects
 *   Employee  → read/update only projects with assigned_to = auth.uid()
 *   service_role (LLM) → server-side key only; app code scopes every mutation
 *   to the acting user's id. Key never reaches the client.
 */

import { createClient, type SupabaseClient, type User as SBUser } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let checked = false;
let available = false;

/** Hard ceiling on any single Supabase request — a hung upstream must never
 * freeze a login or page render; the app degrades to the local store instead. */
const SUPABASE_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SUPABASE_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchWithTimeout } }
  );
  return cached;
}

/** Ping the DB once per process; cheap and cached. */
export async function supabaseAvailable(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  if (checked) return available;
  try {
    const { error } = await sb.from("user_directory").select("id").limit(1);
    available = !error;
    if (error) console.error("Supabase check failed:", error.message);
  } catch (err) {
    console.error("Supabase unreachable:", err);
    available = false;
  }
  checked = true;
  return available;
}

// ---------------------------------------------------------------- auth layer

export interface AppProfile {
  id: string;
  email: string;
  name: string;
  role: "hr" | "employee";
}

function adminClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  return getSupabase(); // the service key IS the admin key in this app
}

/** Create a Supabase Auth user (bcrypt in auth.users) + mirror into user_directory. */
export async function authCreateUser(
  email: string,
  password: string,
  name: string,
  role: "hr" | "employee"
): Promise<{ user: AppProfile | null; error?: string }> {
  const sb = adminClient();
  if (!sb) return { user: null, error: "Supabase not configured" };

  // 1. Create the auth identity (bcrypt happens server-side at Supabase).
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no verification emails on the free-tier demo
    user_metadata: { name, role },
  });
  if (error) {
    if (/already registered|already exists|duplicate/i.test(error.message)) {
      return { user: null, error: "An account with this email already exists" };
    }
    return { user: null, error: error.message };
  }
  const authUser = data.user!;

  // 2. Mirror the app profile into user_directory (service role bypasses RLS).
  const profile: AppProfile = { id: authUser.id, email, name, role };
  const { error: mirErr } = await sb.from("user_directory").insert(profile);
  if (mirErr) {
    // Keep both sides consistent: roll the auth user back.
    await sb.auth.admin.deleteUser(authUser.id);
    return { user: null, error: `Profile write failed: ${mirErr.message}` };
  }
  return { user: profile };
}

/** Verify credentials against Supabase Auth; returns the app profile. */
export async function authVerifyLogin(
  email: string,
  password: string
): Promise<{ profile: AppProfile | null; error?: string }> {
  const sb = adminClient();
  if (!sb) return { profile: null, error: "Supabase not configured" };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { profile: null, error: "Invalid email or password" };
  return { profile: sbProfileFromAuthUser(data.user) };
}

function sbProfileFromAuthUser(u: SBUser): AppProfile {
  const meta = (u.user_metadata ?? {}) as { name?: string; role?: string };
  return {
    id: u.id,
    email: u.email ?? "",
    name: meta.name ?? u.email?.split("@")[0] ?? "Member",
    role: meta.role === "hr" ? "hr" : "employee",
  };
}

/**
 * One-time bridge for the pre-auth data model: the demo accounts (and any
 * projects referencing them) were created before Supabase Auth existed, with
 * stable ids "u-hr" / "u-des". If those accounts don't exist in Auth yet,
 * provision them with their demo passwords (real bcrypt hashes) and record the
 * old-id → auth-id mapping so `assignedTo` references can be remapped.
 */
export async function ensureDemoAccounts(idMap: Record<string, string>): Promise<void> {
  const sb = adminClient();
  if (!sb) return;

  const demo: { oldId: string; email: string; name: string; role: "hr" | "employee"; password: string }[] = [
    { oldId: "u-hr", email: "hr@desgenz.app", name: "Hana Reyes (HR)", role: "hr", password: "demo-hr" },
    { oldId: "u-des", email: "designer@desgenz.app", name: "Devon Park", role: "employee", password: "demo-employee" },
  ];

  for (const d of demo) {
    const { profile } = await authVerifyLogin(d.email, d.password);
    if (profile) {
      if (profile.id !== d.oldId) idMap[d.oldId] = profile.id;
      continue;
    }
    const created = await authCreateUser(d.email, d.password, d.name, d.role);
    if (created.user) idMap[d.oldId] = created.user.id;
    else console.warn(`[auth] demo account ${d.email} not provisioned: ${created.error}`);
  }
}

/**
 * Map legacy project.assignedTo ids ("u-hr" / "u-des") to real auth ids once
 * the demo accounts are provisioned. Mutates the given projects in place.
 */
export function remapAssignments(projects: unknown[], idMap: Record<string, string>): void {
  for (const p of projects as { assignedTo?: string }[]) {
    if (p.assignedTo && idMap[p.assignedTo]) p.assignedTo = idMap[p.assignedTo];
  }
}

/**
 * Create an RLS-scoped Supabase client whose JWT is the logged-in user's.
 * Used to prove the employee-scoped policies actually bite (verification
 * endpoint); the app's own writes go through the service-role client.
 */
export async function scopedClientForUser(
  email: string,
  password: string
): Promise<SupabaseClient | null> {
  const sb = adminClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, data.session.access_token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
