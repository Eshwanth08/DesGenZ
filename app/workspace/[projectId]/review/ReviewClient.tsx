"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, Badge, EmptyState } from "@/components/ui";
import DraftCanvas from "@/components/DraftCanvas";
import { useProject } from "@/lib/client";
import type { Annotation, Draft } from "@/lib/types";

export default function ReviewClient({
  projectId,
  draft,
  annotations: initialAnnotations,
}: {
  projectId: string;
  draft: Draft | null;
  annotations: Annotation[];
}) {
  const router = useRouter();
  const { busy, act, error } = useProject(projectId);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [pending, setPending] = useState<{ page: number; x: number; y: number } | null>(null);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function addAnnotation() {
    if (!pending || !text.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...pending, text: text.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setAnnotations(data.project.annotations.filter((a: Annotation) => a.draftId === draft?.id));
      setPending(null);
      setText("");
    }
  }

  async function resolve(id: string) {
    const res = await fetch(`/api/projects/${projectId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", annotationId: id }),
    });
    const data = await res.json();
    if (res.ok) {
      setAnnotations(data.project.annotations.filter((a: Annotation) => a.draftId === draft?.id));
    }
  }

  async function submitForApproval() {
    await act(`/api/projects/${projectId}/review`, { action: "submit" });
    setSubmitted(true);
    router.refresh();
  }

  if (!draft) {
    return (
      <EmptyState
        title="No draft to review"
        hint="Generate a Stage 6 draft first — review annotates the latest structural pass."
        action={
          <a href={`/workspace/${projectId}/draft`} className="text-sm text-accent hover:underline">
            Go to Draft →
          </a>
        }
      />
    );
  }

  const openCount = annotations.filter((a) => !a.resolved).length;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      {submitted && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Sent for client approval.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Tap anywhere on the page to pin a comment. {openCount > 0 ? `${openCount} open issue${openCount === 1 ? "" : "s"}.` : "All clear — no open issues."}
        </p>
        <Button onClick={submitForApproval} disabled={busy || openCount > 0}>
          {openCount > 0 ? `Resolve ${openCount} issue${openCount === 1 ? "" : "s"} to submit` : "Submit for client approval"}
        </Button>
      </div>

      <div className="relative">
        <DraftCanvas draft={draft} />
        {/* Annotation pins layer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            {annotations
              .filter((a) => a.page === 0)
              .map((a) => (
                <motion.button
                  key={a.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                  onClick={() => resolve(a.id)}
                  title={`${a.author}: ${a.text} (click to toggle resolved)`}
                  className={`pointer-events-auto absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold text-accent-contrast shadow-md ${
                    a.resolved ? "bg-success" : "bg-danger"
                  }`}
                  style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                >
                  {a.resolved ? "✓" : "!"}
                </motion.button>
              ))}
          </AnimatePresence>
        </div>
      </div>

      {pending && (
        <Card hover={false} className="p-4">
          <p className="text-sm font-medium">New annotation (page {pending.page + 1})</p>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to change here?"
            className="mt-2 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:border-accent"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={addAnnotation} disabled={!text.trim()}>Pin annotation</Button>
          </div>
        </Card>
      )}

      <Card hover={false} className="p-4">
        <p className="text-sm font-medium mb-2">Annotations</p>
        {annotations.length === 0 ? (
          <p className="text-sm text-text-secondary">
            None yet. Note: pin placement on the shared canvas is coarse for now — click the canvas on the Draft tab while zoomed out, or use the list here to manage feedback.
          </p>
        ) : (
          <div className="space-y-2">
            {annotations.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className={a.resolved ? "line-through text-text-muted" : ""}>
                    <span className="font-medium">{a.author}</span> — {a.text}
                  </p>
                  <p className="text-xs text-text-muted">{new Date(a.at).toLocaleString()}</p>
                </div>
                <button onClick={() => resolve(a.id)} className="text-xs text-accent hover:underline shrink-0">
                  {a.resolved ? "Reopen" : "Resolve"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
