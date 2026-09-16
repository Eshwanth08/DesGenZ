"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/client";
import { Card, Button, Badge } from "@/components/ui";
import DraftCanvas from "@/components/DraftCanvas";

export default function DraftPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { project, busy, act, error, setProject } = useProject(params.projectId);
  const [message, setMessage] = useState<string | null>(null);

  if (!project) return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;
  const projectId = project.id;

  const latest = project.drafts[project.drafts.length - 1];

  async function generate(pushToFigma: boolean) {
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushToFigma }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Draft generation failed");
        return;
      }
      setProject(data.project);
      setMessage(data.figma || `Draft v${data.project.drafts.length} generated`);
      router.refresh();
    } catch {
      setMessage("Draft generation failed — check the server logs");
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="rounded-md bg-accent-muted px-3 py-2 text-sm text-accent">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Structural first pass — layout, composition, palette, typography. Clearly labeled rough, never client-final.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => generate(false)} disabled={busy}>
            {busy ? "Generating…" : latest ? "Regenerate" : "Generate draft"}
          </Button>
          {latest && !latest.figmaRef && (
            <Button variant="secondary" onClick={() => generate(true)} disabled={busy}>
              Push to Figma (MCP)
            </Button>
          )}
        </div>
      </div>

      {!latest ? (
        <Card hover={false} className="p-10 text-center">
          <p className="font-medium">No draft yet</p>
          <p className="text-sm text-text-secondary mt-1">
            Stage 6 composes structural pages from the confirmed requirements and {project.budgetTier}-tier budget ({project.budgetTier === "starter" ? "3" : project.budgetTier === "premium" ? "10" : "6"} screens).
          </p>
          <Button className="mt-4" onClick={() => generate(false)} disabled={busy}>
            {busy ? "Generating…" : "Generate draft"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={latest.status === "approved" ? "success" : latest.status === "changes_requested" ? "warning" : "blue"}>
              v{latest.version} · {latest.status.replace("_", " ")}
            </Badge>
            {latest.figmaRef && <Badge tone="blue">Figma: {latest.figmaRef}</Badge>}
            <span className="text-xs text-text-muted">Created {new Date(latest.createdAt).toLocaleString()}</span>
          </div>

          <DraftCanvas draft={latest} />

          {latest.notes && (
            <Card hover={false} className="p-4">
              <p className="text-sm font-medium">Generator notes</p>
              <p className="text-sm text-text-secondary mt-1">{latest.notes}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
