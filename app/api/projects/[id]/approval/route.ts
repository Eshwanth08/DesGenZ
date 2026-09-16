import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, newId } from "@/lib/store";

type Params = { params: { id: string } };

// Stage 8: internal decision to send the latest draft to the client for approval
export async function POST(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const decision = body?.decision;
  if (!["approved", "changes_requested", "send_to_client"].includes(decision)) {
    return NextResponse.json({ error: "decision must be approved | changes_requested | send_to_client" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updated = await mutateDB((db) => {
    const p = getProject(db, params.id);
    if (!p) return null;

    if (decision === "send_to_client") {
      if (!p.drafts.length) return null;
      const draft = p.drafts[p.drafts.length - 1];
      draft.status = "in_review";
      // Snapshot the current state as a version entry (Stage 9 metadata)
      p.versions.unshift({
        id: newId("v"),
        label: `v${draft.version} — sent to client`,
        note: String(body?.note || "Draft sent for client approval").slice(0, 300),
        at: now,
        draftId: draft.id,
      });
      p.stage = "approval";
    } else {
      p.approvals.unshift({
        at: now,
        by: user.name,
        decision,
        note: String(body?.note || "").slice(0, 1000),
      });
      if (p.drafts.length) p.drafts[p.drafts.length - 1].status = decision;
    }
    p.updatedAt = now;
    return p;
  });

  if (!updated) return NextResponse.json({ error: "Project or draft not found" }, { status: 404 });
  return NextResponse.json({ project: updated });
}
