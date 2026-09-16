import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, newId, readDB } from "@/lib/store";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const updated = await mutateDB((db) => {
    const p = getProject(db, params.id);
    if (!p) return null;

    if (body.action === "add") {
      const draft = p.drafts[p.drafts.length - 1];
      if (!draft) return null;
      p.annotations.push({
        id: newId("a"),
        draftId: draft.id,
        page: Number(body.page) || 0,
        x: Math.max(0, Math.min(1, Number(body.x) || 0)),
        y: Math.max(0, Math.min(1, Number(body.y) || 0)),
        text: String(body.text || "").slice(0, 500),
        author: user.name,
        at: new Date().toISOString(),
        resolved: false,
      });
    }

    if (body.action === "resolve" && typeof body.annotationId === "string") {
      const ann = p.annotations.find((a) => a.id === body.annotationId);
      if (ann) ann.resolved = !ann.resolved;
    }

    if (body.action === "submit" && p.drafts.length > 0) {
      const draft = p.drafts[p.drafts.length - 1];
      draft.status = "in_review";
      p.stage = "approval";
    }

    p.updatedAt = new Date().toISOString();
    return p;
  });

  if (!updated) return NextResponse.json({ error: "Project, draft or annotation not found" }, { status: 404 });
  return NextResponse.json({ project: updated });
}
