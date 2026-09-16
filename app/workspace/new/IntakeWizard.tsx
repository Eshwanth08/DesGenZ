"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, Input, Textarea, Badge } from "@/components/ui";
import { fadeUp } from "@/components/motion";
import { api } from "@/lib/client";
import type { ExtractedRequirements } from "@/lib/llm";
import type { AnalysisReport, AttachmentMeta, RequirementDoc } from "@/lib/types";

const SAMPLE = `Client: Atlas Coffee Roasters
Project: Atlas Coffee — Brand & Web refresh

Objectives:
- Refresh brand identity for a specialty coffee roaster
- Launch marketing site with online ordering

Deliverables:
- Logo suite
- Brand guide
- Marketing site (6 pages)
- Photography direction

Constraints:
- Must ship before holiday season
- Accessibility AA
- Keep existing CMS

Deadlines:
- Brand guide by Oct 15
- Site launch by Nov 20

Budget: standard tier

Risks:
- Slow client approval loop
- Weather dependency for shoot day`;

const BUDGETS: RequirementDoc["budgetTier"][] = ["starter", "standard", "premium"];

const ACCEPTED = ".txt,.md,.markdown,.docx,.pdf,.rtf";

type Step = "paste" | "confirm";

export default function IntakeWizard() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>("paste");
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [extracted, setExtracted] = useState<ExtractedRequirements | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [engine, setEngine] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      let data: { extracted: ExtractedRequirements; report: AnalysisReport; attachments: AttachmentMeta[] };
      if (files.length > 0) {
        const form = new FormData();
        for (const f of files) form.append("file", f);
        if (rawText.trim()) form.append("text", rawText);
        const res = await fetch("/api/analyze", { method: "POST", body: form });
        data = await res.json();
        if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Analysis failed");
      } else {
        data = await api("/api/analyze", { method: "POST", body: JSON.stringify({ rawText }) });
      }
      setExtracted(data.extracted);
      setReport(data.report);
      setAttachments(data.attachments ?? []);
      setEngine(data.extracted.engine);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError(null);
    try {
      const doc: RequirementDoc = {
        projectName: extracted!.projectName,
        client: extracted!.client,
        objectives: extracted!.objectives,
        deliverables: extracted!.deliverables,
        constraints: extracted!.constraints,
        deadlines: extracted!.deadlines,
        budgetTier: extracted!.budgetTier,
        risks: extracted!.risks,
        missingInfo: extracted!.missingInfo,
        rawText,
        confirmed: true,
        attachments: attachments.length ? attachments : undefined,
        report: report ?? undefined,
      };
      const data = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ requirements: doc }),
      });
      router.push(`/workspace/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project");
      setBusy(false);
    }
  }

  function update<K extends keyof ExtractedRequirements>(key: K, value: ExtractedRequirements[K]) {
    if (!extracted) return;
    setExtracted({ ...extracted, [key]: value });
  }

  return (
    <AnimatePresence mode="wait">
      {step === "paste" && (
        <motion.div key="paste" variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, y: -8 }}>
          <Card hover={false} className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Requirement document</h2>
              <Button variant="ghost" onClick={() => setRawText(SAMPLE)}>
                Load sample doc
              </Button>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Attach files for AI-assisted analysis and report drafting, or paste text — both work, together too.
            </p>

            {/* Dropzone / file picker */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files);
                if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
              }}
              className="mt-4 rounded-lg border-2 border-dashed border-border-subtle bg-bg-base/50 p-6 text-center transition-colors duration-150 hover:border-accent/50"
            >
              <p className="text-sm text-text-secondary">
                Drag files here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-accent font-medium hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-text-muted mt-1">.txt, .md, .docx, .pdf — up to 2MB each</p>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-accent-muted/60 px-3 py-2 text-sm">
                    <span aria-hidden>📎</span>
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="text-xs text-text-muted shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-auto text-text-muted hover:text-danger transition-colors duration-150"
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="…or paste the client's requirement document here"
              className="mt-3 font-mono text-xs"
            />

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end">
              <Button onClick={analyze} disabled={busy || (!rawText.trim() && files.length === 0)}>
                {busy ? "Analyzing…" : files.length > 0 ? "Analyze files with AI" : "Analyze with AI"}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {step === "confirm" && extracted && (
        <motion.div key="confirm" variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, y: -8 }} className="space-y-4">
          {report && (
            <Card hover={false} className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">AI-drafted report</h2>
                <Badge tone={engine === "gemini-2.5-flash" ? "blue" : "neutral"}>
                  {engine === "gemini-2.5-flash" ? "Gemini 2.5 Flash" : "Heuristic engine"}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary mt-1">
                Simplified summary of the attached document — share it with the client or HR as-is.
              </p>

              <div className="mt-4 rounded-lg bg-accent-muted/50 p-4">
                <p className="text-sm font-medium text-accent">Summary</p>
                <p className="mt-1 text-sm text-text-primary">{report.summary}</p>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {report.sections.map((s) => (
              <div key={s.heading} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                <p className="text-sm font-semibold">{s.heading}</p>
                    <ul className="mt-1.5 space-y-1">
                      {s.points.map((p, i) => (
                        <li key={i} className="text-sm text-text-secondary list-disc list-inside">{p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {report.openQuestions.length > 0 && (
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <p className="text-sm font-semibold text-warning">Open questions for the client</p>
                  <ul className="mt-1.5 space-y-1">
                    {report.openQuestions.map((q, i) => (
                      <li key={i} className="text-sm text-text-secondary list-disc list-inside">{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card hover={false} className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Confirm extracted requirements</h2>
              {attachments.length > 0 && (
                <span className="text-xs text-text-secondary">
                  {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Human-in-the-loop check — edit anything the model got wrong. Downstream stages read from what you confirm here.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Project name</label>
                <Input value={extracted.projectName} onChange={(e) => update("projectName", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Client</label>
                <Input value={extracted.client} onChange={(e) => update("client", e.target.value)} className="mt-1" />
              </div>
            </div>

            <ListEditor label="Objectives" items={extracted.objectives} onChange={(v) => update("objectives", v)} />
            <ListEditor label="Deliverables" items={extracted.deliverables} onChange={(v) => update("deliverables", v)} />
            <ListEditor label="Constraints" items={extracted.constraints} onChange={(v) => update("constraints", v)} />
            <ListEditor label="Deadlines" items={extracted.deadlines} onChange={(v) => update("deadlines", v)} />
            <ListEditor label="Risks" items={extracted.risks} onChange={(v) => update("risks", v)} />
            <ListEditor label="Missing information (flagged, never guessed)" items={extracted.missingInfo} onChange={(v) => update("missingInfo", v)} />

            <div className="mt-4">
              <label className="text-sm font-medium">Budget / pricing tier</label>
              <div className="mt-1.5 flex gap-2">
                {BUDGETS.map((b) => (
                  <button
                    key={b}
                    onClick={() => update("budgetTier", b)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize border transition-colors duration-150 ${
                      extracted.budgetTier === b
                        ? "bg-accent text-accent-contrast border-accent"
                        : "bg-bg-surface border-border-subtle text-text-secondary hover:bg-accent-muted"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-6 flex justify-between">
              <Button variant="secondary" onClick={() => setStep("paste")}>
                Back
              </Button>
              <Button onClick={createProject} disabled={busy || !extracted.projectName.trim()}>
                {busy ? "Creating workspace…" : "Confirm & create workspace"}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [customizing, setCustomizing] = useState(false);
  const visible = items.filter((x) => x.trim().length > 0);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {label}
          {visible.length === 0 && <span className="ml-2 text-xs font-normal text-text-muted">nothing detected — customize to add</span>}
        </label>
        <button
          type="button"
          onClick={() => setCustomizing((v) => !v)}
          title={customizing ? "Done customizing" : "Customize — add or remove items"}
          aria-label={`Customize ${label}`}
          aria-expanded={customizing}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-150 ${
            customizing
              ? "bg-accent text-accent-contrast"
              : "text-text-muted hover:bg-accent-muted hover:text-text-primary"
          }`}
        >
          <span aria-hidden>✎</span>
          {customizing ? "Done" : "Customize"}
        </button>
      </div>

      <div className="mt-1.5 space-y-1.5">
        {visible.map((item) => {
          const i = items.indexOf(item);
          return (
            <div key={i} className="flex gap-1.5">
              <Input
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
              {customizing && (
                <button
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="px-2 text-text-muted hover:text-danger transition-colors duration-150"
                  aria-label={`Remove ${label} item`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {customizing && (
          <button
            onClick={() => onChange([...items, ""])}
            className="w-full rounded-md border border-dashed border-border-subtle px-3 py-2 text-xs text-text-secondary transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            + Add a {label.toLowerCase().replace(/ \(.*\)/, "").replace(/s$/, "")} item
          </button>
        )}
      </div>
    </div>
  );
}
