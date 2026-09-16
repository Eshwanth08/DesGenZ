import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sanitizeUser } from "@/lib/auth";
import { mutateDB, readDB, isCloudMode, writeCloudProfiles } from "@/lib/store";
import type { Role } from "@/lib/types";

/**
 * HR authority over people + access:
 *  GET   → sanitized team list (never password hashes), workload stats,
 *          project list for the assignment editor, and who the caller is.
 *  PATCH → { userId, role }              change a member's role (not your own)
 *          { action: "assign", projectId, userId }    give an employee a project
 *          { action: "unassign", projectId }          revoke access
 * Employees never reach this route (403), so the team data HR controls stays
 * HR-only — matching spec §2: "HR sees people-data tables".
 */
export async function GET() {
  const me = await getSession();
  if (!me || me.role !== "hr") {
    return NextResponse.json({ error: "HR access required" }, { status: 403 });
  }
  const db = await readDB();
  const users = db.users.map((u) => {
    const assigned = db.projects.filter((p) => p.assignedTo === u.id);
    return {
      ...sanitizeUser(u),
      projectCount: assigned.length,
      activeCount: assigned.filter((p) => p.stage !== "portal").length,
      avgFeasibility: assigned.length
        ? Math.round(assigned.reduce((n, p) => n + (p.intelligence?.feasibility ?? 65), 0) / assigned.length)
        : null,
    };
  });
  return NextResponse.json({
    users,
    me: me.id,
    projects: db.projects.map((p) => ({ id: p.id, name: p.client || p.name, assignedTo: p.assignedTo })),
  });
}

export async function PATCH(req: Request) {
  const me = await getSession();
  if (!me || me.role !== "hr") {
    return NextResponse.json({ error: "HR access required" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);

  // ---- role change -------------------------------------------------------
  if (typeof body?.userId === "string" && typeof body?.role === "string") {
    const { userId, role } = body as { userId: string; role: string };
    if (!["hr", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (userId === me.id) {
      return NextResponse.json(
        { error: "You can't change your own role — ask another HR admin" },
        { status: 400 }
      );
    }
    const nextRole = role as Role;
    const updated = await mutateDB((db) => {
      const target = db.users.find((u) => u.id === userId);
      if (target) target.role = nextRole;
      return db;
    });
    if (await isCloudMode()) {
      await writeCloudProfiles(updated.users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
    }
    return NextResponse.json({ ok: true });
  }

  // ---- project assignment ------------------------------------------------
  if (body?.action === "assign" && typeof body.projectId === "string" && typeof body.userId === "string") {
    const { projectId, userId } = body as { projectId: string; userId: string };
    if (userId === "unassigned") return unassign(projectId);
    const result = await mutateDB((db) => {
      const project = db.projects.find((p) => p.id === projectId);
      const target = db.users.find((u) => u.id === userId);
      if (!project) return { error: "Project not found" };
      if (!target) return { error: "Member not found" };
      if (target.role !== "employee") return { error: "Projects can only be assigned to employees" };
      project.assignedTo = target.id;
      project.updatedAt = new Date().toISOString();
      return { ok: true };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "unassign" && typeof body.projectId === "string") {
    return unassign(body.projectId);
  }

  return NextResponse.json({ error: "Unsupported request" }, { status: 400 });
}

async function unassign(projectId: string) {
  const result = await mutateDB((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return { error: "Project not found" };
    project.assignedTo = "";
    project.updatedAt = new Date().toISOString();
    return { ok: true };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
