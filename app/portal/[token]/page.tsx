import { readDB } from "@/lib/store";
import { notFound } from "next/navigation";
import PortalClient from "./PortalClient";
import type { Draft } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "DesGenZ — Client portal" };

export default async function PortalPage({ params }: { params: { token: string } }) {
  const db = await readDB();
  const project = db.projects.find((p) => p.portalToken === params.token);
  if (!project) notFound();

  const latest = project.drafts[project.drafts.length - 1];
  const milestonesDone = project.milestones.length
    ? Math.min(3, project.tasks.filter((t) => t.status === "done").length)
    : 0;

  return (
    <PortalClient
      projectId={project.id}
      token={project.portalToken}
      name={project.name}
      client={project.client}
      stage={project.stage}
      tier={project.budgetTier}
      objectives={project.requirements.objectives}
      deadlines={project.requirements.deadlines}
      tasksDone={project.tasks.filter((t) => t.status === "done").length}
      tasksTotal={project.tasks.length}
      milestonesTotal={project.milestones.length}
      milestonesDone={milestonesDone}
      draft={latest ?? null}
      lastDecision={project.approvals[0] ?? null}
    />
  );
}
