import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, readDB } from "@/lib/store";

type Params = { params: { id: string } };

// Designer actions
export async function POST(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.action !== "publish") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await mutateDB((db) => {
    const p = getProject(db, params.id);
    if (!p) return null;
    p.stage = "portal";
    p.updatedAt = new Date().toISOString();
    return p;
  });
  if (!updated) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json({
    project: updated,
    link: `/portal/${updated.portalToken}`,
  });
}

// Client (token) decision — authorized by portalToken, not session.
export async function PUT(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  const decision = body?.decision === "approved" ? "approved" : body?.decision === "changes_requested" ? "changes_requested" : null;
  if (!decision) return NextResponse.json({ error: "decision must be approved|changes_requested" }, { status: 400 });

  const db = await readDB();
  const project = db.projects.find((p) => p.id === params.id);
  if (!project || project.portalToken !== token) {
    return NextResponse.json({ error: "Invalid portal link" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const updated = await mutateDB((db2) => {
    const p = db2.projects.find((x) => x.id === params.id)!;
    p.approvals.unshift({ at: now, by: `Client (${p.client})`, decision, note: String(body?.note || "").slice(0, 1000) });
    if (p.drafts.length) p.drafts[p.drafts.length - 1].status = decision;
    if (decision === "changes_requested") {
      p.stage = "review";
    }
    p.updatedAt = now;
    return p;
  });
  return NextResponse.json({ project: updated });
}
