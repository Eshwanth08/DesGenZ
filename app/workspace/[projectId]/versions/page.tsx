"use client";

import { useProject } from "@/lib/client";
import { Card, Badge, EmptyState } from "@/components/ui";
import { staggerList, listItem } from "@/components/motion";
import { motion } from "framer-motion";

export default function VersionsPage({ params }: { params: { projectId: string } }) {
  const { project } = useProject(params.projectId);

  if (!project) return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">Snapshots and approval metadata — Figma remains the source of truth for file history.</p>
      {project.versions.length === 0 ? (
        <EmptyState title="No versions yet" hint="Regenerating a draft or sending one to the client records a version entry here." />
      ) : (
        <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-2">
          {project.versions.map((v) => (
            <motion.div key={v.id} variants={listItem}>
              <Card className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.label}</p>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{v.note}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge tone="neutral">{new Date(v.at).toLocaleDateString()}</Badge>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
      {project.approvals.length > 0 && (
        <Card hover={false} className="p-5">
          <h2 className="font-semibold">Approval history</h2>
          <div className="mt-3 space-y-2 text-sm">
            {project.approvals.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div>
                  <Badge tone={a.decision === "approved" ? "success" : "warning"}>{a.decision === "approved" ? "Approved" : "Changes requested"}</Badge>
                  <span className="ml-2 text-text-secondary">{a.note || "—"}</span>
                </div>
                <span className="text-xs text-text-muted shrink-0">{a.by} · {new Date(a.at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
