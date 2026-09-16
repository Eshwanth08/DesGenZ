"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/client";
import { Card, Button, Badge, EmptyState, Input } from "@/components/ui";
import { staggerList, listItem } from "@/components/motion";
import { motion } from "framer-motion";
import type { Task } from "@/lib/types";

export default function TasksPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { project, busy, act, error, setProject } = useProject(params.projectId);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  if (!project) return <div className="h-40 rounded-lg bg-bg-faint animate-pulse" />;
  const projectId = project.id;

  async function generateTasks() {
    await act(`/api/projects/${projectId}/tasks`);
    router.refresh();
  }

  async function updateTask(taskId: string, patch: Record<string, unknown>) {
    const data = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...patch }),
    });
    const json = await data.json();
    if (data.ok) setProject(json.project);
  }

  const PRIORITY_TONE: Record<Task["priority"], "danger" | "warning" | "neutral"> = {
    high: "danger",
    medium: "warning",
    low: "neutral",
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Auto-generated from confirmed requirements; edit freely.</p>
        <Button onClick={generateTasks} disabled={busy}>
          {busy ? "Generating…" : project.tasks.length ? "Regenerate tasks" : "Generate tasks (AI)"}
        </Button>
      </div>

      {project.tasks.length === 0 ? (
        <EmptyState title="No tasks yet" hint="Generate an AI task list from the confirmed requirements." action={<Button onClick={generateTasks}>Generate tasks</Button>} />
      ) : (
        <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-2.5">
          {project.tasks.map((task) => (
            <motion.div key={task.id} variants={listItem}>
              <TaskCard task={task} onUpdate={(patch) => updateTask(task.id, patch)} busy={busy}
                commentDraft={commentDraft[task.id] ?? ""}
                setCommentDraft={(v) => setCommentDraft((d) => ({ ...d, [task.id]: v }))}
                deps={task.dependsOn.map((id) => project.tasks.find((t) => t.id === id)?.title).filter(Boolean) as string[]}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

const PRIORITY_TONE: Record<Task["priority"], "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

function TaskCard({
  task,
  onUpdate,
  busy,
  commentDraft,
  setCommentDraft,
  deps,
}: {
  task: Task;
  onUpdate: (patch: Record<string, unknown>) => void;
  busy: boolean;
  commentDraft: string;
  setCommentDraft: (v: string) => void;
  deps: string[];
}) {
  const [open, setOpen] = useState(false);
  const done = task.status === "done";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onUpdate({ status: done ? "todo" : "done" })}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 ${
            done ? "bg-success border-success text-accent-contrast" : "border-border-subtle hover:border-accent"
          }`}
          aria-label={done ? "Mark as todo" : "Mark as done"}
        >
          {done && <span className="text-[10px]">✓</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-medium text-sm ${done ? "line-through text-text-muted" : ""}`}>{task.title}</p>
            <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
            {task.status === "doing" && <Badge tone="blue">in progress</Badge>}
            {deps.length > 0 && <span className="text-xs text-text-muted">after: {deps.join(", ")}</span>}
          </div>

          {task.checklist.length > 0 && (
            <div className="mt-2 space-y-1">
              {task.checklist.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const next = task.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
                    onUpdate({ checklist: next });
                  }}
                  className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors duration-150"
                >
                  <span className={`grid h-3.5 w-3.5 place-items-center rounded-sm border ${c.done ? "bg-success border-success text-accent-contrast" : "border-border-subtle"}`}>
                    {c.done && <span className="text-[8px]">✓</span>}
                  </span>
                  <span className={c.done ? "line-through text-text-muted" : ""}>{c.text}</span>
                </button>
              ))}
            </div>
          )}

          {task.comments.length > 0 && (
            <div className="mt-2 space-y-1">
              {task.comments.map((c, i) => (
                <p key={i} className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">{c.author}</span> — {c.text}
                </p>
              ))}
            </div>
          )}

          {open && (
            <div className="mt-3 flex gap-1.5">
              <Input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                className="text-xs"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (commentDraft.trim()) {
                    onUpdate({ comment: commentDraft.trim() });
                    setCommentDraft("");
                  }
                }}
              >
                Post
              </Button>
            </div>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs text-text-muted hover:text-accent transition-colors duration-150">
          {open ? "Close" : "Comment"}
        </button>
      </div>
    </Card>
  );
}
