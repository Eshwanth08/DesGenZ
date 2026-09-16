"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/client";
import { Card, Badge, Button, Stat } from "@/components/ui";
import { motion } from "framer-motion";

function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const tone = value >= 70 ? "bg-success" : value >= 55 ? "bg-warning" : "bg-danger";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
      <div className="mt-1 h-2 rounded-full bg-bg-faint overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className={`h-full rounded-full ${tone}`}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export default function ProjectOverview({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { project, busy, act, error } = useProject(params.projectId);

  if (!project) {
    return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;
  }

  const req = project.requirements;
  const runIntelligence = async () => {
    await act(`/api/projects/${project.id}/intelligence`);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card hover={false} className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Project intelligence</h2>
            {project.intelligence && <Badge tone="blue">Scored</Badge>}
          </div>
          {project.intelligence ? (
            <div className="mt-4 space-y-4">
              <ScoreBar label="Complexity" value={project.intelligence.complexity} hint="Deliverable count, constraints, tier" />
              <ScoreBar label="Deadline feasibility" value={project.intelligence.feasibility} hint="Timeline vs. scope; < 55 flags schedule risk" />
              <ScoreBar label="Budget realism" value={project.intelligence.budgetRealism} hint="Scope vs. pricing tier" />
              <div className="rounded-lg bg-accent-muted/60 p-3 text-sm">
                <p className="font-medium text-accent">Reasoning</p>
                <p className="mt-1 text-text-secondary">{project.intelligence.rationale}</p>
                <p className="mt-2 text-xs text-text-muted">Basis: {project.intelligence.basis}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-text-secondary">
                Stage 3 hasn&apos;t run yet. The Intelligence Engine scores complexity, deadline feasibility and budget realism — with visible reasoning, never a bare number.
              </p>
              <Button className="mt-3" onClick={runIntelligence} disabled={busy}>
                {busy ? "Scoring…" : "Run intelligence scoring"}
              </Button>
            </div>
          )}
        </Card>

        <Card hover={false} className="p-5">
          <h2 className="font-semibold">Confirmed requirements</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <RequirementList label="Objectives" items={req.objectives} />
            <RequirementList label="Deliverables" items={req.deliverables} />
            <RequirementList label="Constraints" items={req.constraints} />
            <RequirementList label="Deadlines" items={req.deadlines} />
            <RequirementList label="Risks" items={req.risks} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">Missing info</dt>
              <dd className="mt-1">
                {req.missingInfo.length ? (
                  <ul className="space-y-1">
                    {req.missingInfo.map((m, i) => (
                      <li key={i} className="flex gap-1.5 text-warning">
                        <span aria-hidden>▲</span>
                        <span className="text-text-secondary">{m}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-text-muted">None flagged</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tasks" value={project.tasks.length} />
        <Stat label="Done" value={project.tasks.filter((t) => t.status === "done").length} tone="success" />
        <Stat label="Drafts" value={project.drafts.length} />
        <Stat label="Open annotations" value={project.annotations.filter((a) => !a.resolved).length} tone={project.annotations.some((a) => !a.resolved) ? "warning" : "default"} />
      </div>

      <Card hover={false} className="p-5">
        <h2 className="font-semibold">Pipeline</h2>
        <p className="text-sm text-text-secondary mt-1">Continue through the stages in order — each one reads from the confirmed requirements.</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PipelineLink href={`/workspace/${project.id}/tasks`} label="Tasks" desc="Stage 4 — generate & manage" />
          <PipelineLink href={`/workspace/${project.id}/schedule`} label="Schedule" desc="Stage 5 — milestone plan" />
          <PipelineLink href={`/workspace/${project.id}/draft`} label="Draft" desc="Stage 6 — structural draft" />
          <PipelineLink href={`/workspace/${project.id}/approval`} label="Approval" desc="Stage 8 — client sign-off" />
        </div>
      </Card>
    </div>
  );
}

function RequirementList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="mt-1">
        <ul className="list-disc list-inside space-y-0.5 text-text-secondary">
          {items.map((item, i) => (
            <li key={i}>{item || <span className="text-text-muted">—</span>}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function PipelineLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border-subtle p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-bg-surface">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
    </Link>
  );
}
