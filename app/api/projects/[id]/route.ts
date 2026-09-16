import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, readDB } from "@/lib/store";
import type { Project, ProjectStage } from "@/lib/types";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDB();
  const project = getProject(db, params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  // §2 scoping: employees may only read projects assigned to them; the project
  // content HR "provides" is exactly the assignment.
  if (user.role === "employee" && project.assignedTo !== user.id) {
    return NextResponse.json({ error: "This project is not assigned to you" }, { status: 403 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const updated = await mutateDB((db) => {
    const project = getProject(db, params.id);
    if (!project) return null;
    if (user.role === "employee" && project.assignedTo !== user.id) {
      return null; // surfaced as 403 below
    }
    if (body.requirements) {
      project.requirements = { ...project.requirements, ...body.requirements, confirmed: true };
      project.name = project.requirements.projectName || project.name;
      project.client = project.requirements.client || project.client;
      project.budgetTier = project.requirements.budgetTier;
    }
    if (typeof body.stage === "string") {
      project.stage = body.stage as ProjectStage;
    }
    project.updatedAt = new Date().toISOString();
    return project;
  });

  if (!updated) {
    const db = await readDB();
    const exists = Boolean(getProject(db, params.id));
    return NextResponse.json(
      { error: exists ? "This project is not assigned to you" : "Project not found" },
      { status: exists ? 403 : 404 }
    );
  }
  return NextResponse.json({ project: updated satisfies Project });
}
