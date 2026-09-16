"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button, Badge } from "@/components/ui";
import DraftCanvas from "@/components/DraftCanvas";
import { api } from "@/lib/client";
import type { Draft } from "@/lib/types";

interface Props {
  projectId: string;
  token: string;
  name: string;
  client: string;
  stage: string;
  tier: string;
  objectives: string[];
  deadlines: string[];
  tasksDone: number;
  tasksTotal: number;
  milestonesTotal: number;
  milestonesDone: number;
  draft: Draft | null;
  lastDecision: { decision: string; note: string; at: string } | null;
}

export default function PortalClient(props: Props) {
  const { token, name, client, objectives, deadlines, tasksDone, tasksTotal, draft, lastDecision } = props;
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<string | null>(lastDecision?.decision ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: "approved" | "changes_requested") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${props.projectId}/portal`, {
        method: "PUT",
        body: JSON.stringify({ token, decision, note }),
      });
      setDecision(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Shared by DesGenZ</p>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{name}</h1>
          <p className="text-text-secondary text-sm mt-0.5">Prepared for {client}</p>
        </header>

        <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-sm p-5">
          <h2 className="font-semibold">Progress</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Tasks</p>
              <p className="text-xl font-bold">{tasksDone}<span className="text-text-muted text-sm">/{tasksTotal}</span></p>
            </div>
            <div>
              <p className="text-text-secondary">Milestones</p>
              <p className="text-xl font-bold">{props.milestonesDone}<span className="text-text-muted text-sm">/{props.milestonesTotal}</span></p>
            </div>
          </div>
          {objectives.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Objectives</p>
              <ul className="list-disc list-inside text-sm text-text-secondary mt-1">
                {objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {deadlines.length > 0 && (
            <p className="mt-3 text-xs text-text-secondary">Key dates: {deadlines.join(" · ")}</p>
          )}
        </div>

        {draft ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Draft v{draft.version}</h2>
              <Badge tone="warning">rough structural pass</Badge>
            </div>
            <p className="text-xs text-text-secondary">
              This is an early structural draft (layout, palette, typography direction) — not the finished design.
            </p>
            <DraftCanvas draft={draft} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-text-secondary">
            Your first draft is in progress — check back soon.
          </div>
        )}

        <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-sm p-5">
          <h2 className="font-semibold">Your decision</h2>
          {decision ? (
            <p className={`mt-2 text-sm ${decision === "approved" ? "text-success" : "text-warning"}`}>
              {decision === "approved" ? "Approved — thank you!" : "Change request sent — the designer will follow up."}
            </p>
          ) : (
            <>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note with your feedback…"
                className="mt-2 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:border-accent"
              />
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              <div className="mt-3 flex gap-2">
                <Button onClick={() => send("approved")} disabled={busy}>Approve</Button>
                <Button variant="secondary" onClick={() => send("changes_requested")} disabled={busy}>Request changes</Button>
              </div>
            </>
          )}
        </div>

        {lastDecision && decision && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-text-muted text-center">
            Previous decision: {lastDecision.decision.replace("_", " ")} on {new Date(lastDecision.at).toLocaleDateString()}
          </motion.p>
        )}
      </div>
    </main>
  );
}
