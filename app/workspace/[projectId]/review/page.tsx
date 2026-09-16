import { requireRole } from "@/lib/session";
import { readDB, getProject } from "@/lib/store";
import ReviewClient from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: { projectId: string } }) {
  await requireRole("employee");
  const db = await readDB();
  const project = getProject(db, params.projectId);
  if (!project) return <p className="text-sm text-danger">Project not found.</p>;

  const latest = project.drafts[project.drafts.length - 1];
  return (
    <ReviewClient
      projectId={project.id}
      draft={latest ?? null}
      annotations={project.annotations.filter((a) => !latest || a.draftId === latest.id)}
    />
  );
}
