import type { Analytics, DB, Project } from "./types";
import { DEFAULT_SEED } from "./seed";
import { getSupabase, supabaseConfigured, ensureDemoAccounts, remapAssignments } from "./supabase";

const DATA_DIR = process.env.DESGENZ_DATA_DIR || "data";
const DB_FILE = `${DATA_DIR}/db.local.json`;

let cache: DB | null = null;
let writeChain: Promise<void> = Promise.resolve();
let cloudMode = false; // sticky per process: once Supabase answers, we stay on it

export async function isCloudMode(): Promise<boolean> {
  return cloudMode;
}

// ------------------------------------------------------------------ local JSON

async function ensureDir(): Promise<void> {
  const fs = await import("fs");
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function readLocal(): Promise<DB> {
  if (cache) return cache;
  const fs = await import("fs");
  try {
    const raw = await fs.promises.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as DB;
  } catch {
    cache = structuredClone(DEFAULT_SEED);
    await ensureDir();
    await fs.promises.writeFile(DB_FILE, JSON.stringify(cache, null, 2), "utf8");
  }
  return cache;
}

async function writeLocal(db: DB): Promise<void> {
  cache = db;
  writeChain = writeChain.then(async () => {
    const fs = await import("fs");
    await ensureDir();
    await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  });
  await writeChain;
}

// -------------------------------------------------------------------- Supabase

function rowToProject(row: { data: unknown }): Project {
  return row.data as Project;
}

function projectToRow(p: Project) {
  return {
    id: p.id,
    data: p,
    name: p.name,
    client: p.client,
    stage: p.stage,
    budget_tier: p.budgetTier,
    assigned_to: p.assignedTo,
    portal_token: p.portalToken,
    updated_at: new Date().toISOString(),
  };
}

async function readCloud(): Promise<DB> {
  const sb = getSupabase()!;
  const [{ data: userRows, error: userErr }, { data: projectRows, error: projErr }] = await Promise.all([
    sb.from("user_directory").select("id,email,name,role"),
    sb.from("projects").select("data").order("created_at", { ascending: false }),
  ]);
  if (userErr) throw new Error(`Supabase user_directory read failed: ${userErr.message}`);
  if (projErr) throw new Error(`Supabase projects read failed: ${projErr.message}`);

  const db: DB = {
    users: (userRows ?? []).map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role as "hr" | "employee" })),
    projects: (projectRows ?? []).map(rowToProject),
  };

  // One-time migration from the pre-auth store: whenever a demo account is
  // missing from Auth, provision it (bcrypt), mirror its profile, remap legacy
  // ids and re-link any unassigned projects to the designer account.
  const demoEmails = ["hr@desgenz.app", "designer@desgenz.app"];
  if (demoEmails.some((e) => !db.users.some((u) => u.email.toLowerCase() === e))) {
    const idMap: Record<string, string> = {};
    await ensureDemoAccounts(idMap);
    const { data: reread, error: rereadErr } = await sb.from("user_directory").select("id,email,name,role");
    if (rereadErr) throw new Error(`Supabase user_directory reread failed: ${rereadErr.message}`);
    db.users = (reread ?? []).map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role as "hr" | "employee" }));
    if (db.users.length) {
      remapAssignments(db.projects, idMap);
      for (const p of db.projects) {
        if (!p.assignedTo) p.assignedTo = idMap["u-des"] ?? p.assignedTo;
      }
      if (db.projects.length) {
        const { error } = await sb.from("projects").upsert(db.projects.map(projectToRow));
        if (error) console.error("[store] project re-link failed:", error.message);
      }
    }
  }

  if (db.projects.length === 0 && (await localFileExists())) {
    // Adopt any locally-created projects so nothing is lost when switching modes.
    const local = await readLocal();
    if (local.projects.length) {
      const designer = db.users.find((u) => u.role === "employee");
      for (const p of local.projects) {
        if (!p.assignedTo || p.assignedTo.startsWith("u-")) p.assignedTo = designer?.id ?? p.assignedTo;
      }
      const { error } = await sb.from("projects").upsert(local.projects.map(projectToRow));
      if (error) throw new Error(`Supabase adoption of local projects failed: ${error.message}`);
      db.projects = local.projects;
    }
  }
  cache = db;
  return db;
}

async function localFileExists(): Promise<boolean> {
  try {
    const fs = await import("fs");
    await fs.promises.access(DB_FILE);
    return true;
  } catch {
    return false;
  }
}

async function writeCloud(db: DB): Promise<void> {
  const sb = getSupabase()!;
  cache = db;
  // Auth identities + profiles live in auth.users / user_directory and change
  // only via sign-up or HR role edits — writes here cover projects; profiles
  // (name/role) are synced by writeCloudProfiles when HR mutates them.
  const { error: projErr } = await sb.from("projects").upsert(db.projects.map(projectToRow));
  if (projErr) throw new Error(`Supabase projects write failed: ${projErr.message}`);
}

/** Sync changed profiles (name/role) into user_directory — used by HR edits. */
export async function writeCloudProfiles(users: { id: string; email: string; name: string; role: "hr" | "employee" }[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("user_directory").upsert(users);
  if (error) throw new Error(`Supabase user_directory write failed: ${error.message}`);
}

// ------------------------------------------------------------------ public API

/**
 * Read the whole DB. Cloud mode engages automatically when Supabase env vars
 * are present AND reachable; any cloud failure falls back to local JSON so the
 * app never hard-fails. Errors are logged loudly either way.
 */
export async function readDB(): Promise<DB> {
  if (supabaseConfigured()) {
    try {
      const db = await readCloud();
      cloudMode = true;
      return db;
    } catch (err) {
      console.error("[store] Supabase unavailable — using local JSON store:", err instanceof Error ? err.message : err);
    }
  }
  cloudMode = false;
  return readLocal();
}

export async function writeDB(db: DB): Promise<void> {
  if (cloudMode) {
    await writeCloud(db);
    return;
  }
  await writeLocal(db);
}

export async function mutateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const db = await readDB();
  const result = await fn(db);
  await writeDB(db);
  return result;
}

export function getProject(db: DB, id: string): Project | undefined {
  return db.projects.find((p) => p.id === id);
}

export function analytics(db: DB): Analytics {
  const total = db.projects.length;
  const approved = db.projects.filter((p) => p.approvals.some((a) => a.decision === "approved")).length;
  const withIntelligence = db.projects.filter((p) => p.intelligence);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const rework = db.projects.reduce((n, p) => n + p.approvals.filter((a) => a.decision === "changes_requested").length, 0);
  const delayed = db.projects.filter((p) => (p.intelligence?.feasibility ?? 100) < 55).length;
  return {
    totalProjects: total,
    activeProjects: total - approved,
    approvedProjects: approved,
    avgComplexity: avg(withIntelligence.map((p) => p.intelligence!.complexity)),
    avgFeasibility: avg(withIntelligence.map((p) => p.intelligence!.feasibility)),
    reworkCount: rework,
    delayedCount: delayed,
    completionRate: total ? Math.round((approved / total) * 100) : 0,
  };
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
