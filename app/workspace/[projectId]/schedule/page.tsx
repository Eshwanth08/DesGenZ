"use client";

import { useRouter } from "next/navigation";
import { useProject } from "@/lib/client";
import { Card, Button, EmptyState, Badge } from "@/components/ui";
import { motion } from "framer-motion";

export default function SchedulePage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { project, busy, act, error } = useProject(params.projectId);

  if (!project) return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;
  const projectId = project.id;

  async function generate() {
    await act(`/api/projects/${projectId}/schedule`);
    router.refresh();
  }

  const totalDays = project.milestones.length ? Math.max(...project.milestones.map((m) => m.endDay)) : 0;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Milestone plan paced by the feasibility score {project.intelligence ? `(${project.intelligence.feasibility}/100)` : ""}.
        </p>
        <Button onClick={generate} disabled={busy}>
          {busy ? "Planning…" : project.milestones.length ? "Re-plan schedule" : "Generate schedule (AI)"}
        </Button>
      </div>

      {project.milestones.length === 0 ? (
        <EmptyState title="No schedule yet" hint="Generate tasks first, then build a milestone plan." />
      ) : (
        <Card hover={false} className="p-5">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-4">
            <span>Day 1</span>
            <span>{totalDays} days total</span>
          </div>
          <div className="space-y-3">
            {project.milestones.map((m, i) => (
              <div key={m.id} className="relative">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium">{m.name}</p>
                  <span className="text-xs text-text-muted">days {m.startDay}–{m.endDay}</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-bg-faint overflow-hidden">
                  <motion.div
                    initial={{ width: 0, x: 0 }}
                    animate={{
                      width: `${((m.endDay - m.startDay + 1) / totalDays) * 100}%`,
                      x: `${(m.startDay - 1) / totalDays * 100}%`,
                    }}
                    transition={{ duration: 0.35, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
                    className={`h-full rounded-full ${
                      i === project.milestones.length - 1 ? "bg-accent-muted" : "bg-accent"
                    }`}
                  />
                </div>
                {m.taskIds.length > 0 && (
                  <p className="mt-1 text-xs text-text-muted">{m.taskIds.length} task{m.taskIds.length === 1 ? "" : "s"} in this phase</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">
            Adjusting for scope or deadline changes re-plans automatically when you re-run this — Stage 5 [S] auto-adjustment builds on the same plan.
          </p>
        </Card>
      )}
    </div>
  );
}
