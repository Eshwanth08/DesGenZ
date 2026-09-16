import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { mutateDB, readDB, newId } from "@/lib/store";
import type { Project, RequirementDoc } from "@/lib/types";

/** List projects — employees see ONLY what HR assigned to them (spec §2). */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDB();
  const projects =
    user.role === "hr" ? db.projects : db.projects.filter((p) => p.assignedTo === user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Only employees create projects" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const requirements = body?.requirements as RequirementDoc | undefined;
  if (!requirements || !requirements.projectName) {
    return NextResponse.json({ error: "Confirmed requirements required" }, { status: 400 });
  }
  requirements.confirmed = true;

  const project: Project = {
    id: newId("p"),
    name: requirements.projectName,
    client: requirements.client,
    budgetTier: requirements.budgetTier,
    stage: "intelligence",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requirements,
    tasks: [],
    milestones: [],
    drafts: [],
    annotations: [],
    approvals: [],
    versions: [],
    portalToken: newId("tok"),
    assignedTo: user.id,
  };

  await mutateDB((db) => {
    db.projects.unshift(project);
  });
  return NextResponse.json({ project });
}
