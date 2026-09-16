"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/client";
import { Card, Button, Badge, Textarea, EmptyState } from "@/components/ui";

export default function ApprovalPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { project, busy, act, error } = useProject(params.projectId);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  if (!project) return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;

  const latest = project.drafts[project.drafts.length - 1];
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/${project.portalToken}` : "";
  const clientDecision = project.approvals[0];

  async function decide(decision: "approved" | "changes_requested") {
    if (!project) return;
    await act(`/api/projects/${params.projectId}/approval`, { decision, note });
    setNote("");
    router.refresh();
  }

  async function sendToClient() {
    if (!project) return;
    await act(`/api/projects/${params.projectId}/approval`, { decision: "send_to_client", note: note || "Draft sent for client approval" });
    setNote("");
    router.refresh();
  }

  async function exportPdf() {
    if (!project) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const req = project.requirements;
    const int = project.intelligence;

    doc.setFontSize(20);
    doc.text("DesGenZ — Delivery package", 20, 20);
    doc.setFontSize(14);
    doc.text(project.name, 20, 30);
    doc.setFontSize(10);
    doc.text(`Client: ${project.client} · Tier: ${project.budgetTier}`, 20, 37);

    let y = 48;
    const section = (title: string, lines: string[]) => {
      doc.setFontSize(12);
      doc.text(title, 20, y);
      y += 6;
      doc.setFontSize(10);
      for (const line of lines) {
        for (const wrapped of doc.splitTextToSize(line, 170)) {
          doc.text(wrapped, 22, y);
          y += 5;
        }
      }
      y += 4;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    };

    section("Confirmed requirements", [
      `Objectives: ${req.objectives.join("; ")}`,
      `Deliverables: ${req.deliverables.join("; ")}`,
      `Constraints: ${req.constraints.join("; ")}`,
      `Deadlines: ${req.deadlines.join("; ")}`,
      `Missing info: ${req.missingInfo.join("; ") || "none"}`,
    ]);
    if (int) {
      section("Intelligence scores", [
        `Complexity ${int.complexity}/100 · Feasibility ${int.feasibility}/100 · Budget realism ${int.budgetRealism}/100`,
        int.rationale,
      ]);
    }
    if (latest) {
      section(`Latest draft (v${latest.version}, ${latest.status})`, [
        `Pages: ${latest.pages.map((p) => p.name).join(", ")}`,
        `Palette: ${latest.palette.join(", ")}`,
        `Typography: ${latest.typography.heading} / ${latest.typography.body} — ${latest.typography.note}`,
      ]);
    }
    if (project.approvals.length) {
      section("Approval history", project.approvals.map((a) => `${new Date(a.at).toLocaleDateString()} — ${a.decision} (${a.by})${a.note ? `: ${a.note}` : ""}`));
    }

    doc.save(`${project.name.replace(/\W+/g, "-").toLowerCase()}-desgenz.pdf`);
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-sm text-text-secondary">
        Simple loop: Draft → Client review → Approved / Change requested. Fast re-generation beats process depth at the rough-draft stage.
      </p>

      {!latest ? (
        <EmptyState title="No draft to send" hint="Generate a draft in Stage 6 first." />
      ) : (
        <Card hover={false} className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge tone={latest.status === "approved" ? "success" : latest.status === "changes_requested" ? "warning" : "blue"}>
                v{latest.version} · {latest.status.replace("_", " ")}
              </Badge>
              <span className="text-xs text-text-muted">{new Date(latest.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {clientDecision && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${clientDecision.decision === "approved" ? "bg-success-muted text-success" : "bg-warning-muted text-warning"}`}>
              Client {clientDecision.decision === "approved" ? "approved" : "requested changes"}
              {clientDecision.note ? `: “${clientDecision.note}”` : ""} — {new Date(clientDecision.at).toLocaleString()}
            </div>
          )}

          <label className="block mt-4 text-sm font-medium">Decision note</label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context sent with the draft or the decision…" className="mt-1" />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={sendToClient} disabled={busy}>
              Send to client for approval
            </Button>
            <Button variant="secondary" onClick={() => decide("approved")} disabled={busy}>
              Record approval
            </Button>
            <Button variant="danger" onClick={() => decide("changes_requested")} disabled={busy}>
              Record change request
            </Button>
            <Button variant="ghost" onClick={exportPdf}>
              Export delivery PDF
            </Button>
          </div>
        </Card>
      )}

      <Card hover={false} className="p-5">
        <h2 className="font-semibold">Client portal (Stage 10)</h2>
        <p className="text-sm text-text-secondary mt-1">Shared-link view — no client login needed. Publishes progress, draft, approval buttons and downloads.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-bg-faint px-2.5 py-1.5 text-xs text-text-secondary max-w-full truncate">{portalUrl}</code>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(portalUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-muted">Publishing status lives on the Portal tab.</p>
      </Card>
    </div>
  );
}
