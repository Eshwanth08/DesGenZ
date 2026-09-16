import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, newId, readDB } from "@/lib/store";
import { tasksFromRequirements } from "@/lib/llm";
import type { Task } from "@/lib/types";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await readDB();
  const project = getProject(db, params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const drafts = tasksFromRequirements(project.requirements);
  const tasks: Task[] = drafts.map((t) => ({ ...t, id: newId("t") }));
  tasks.slice(1).forEach((t, i) => {
    t.dependsOn = [tasks[i].id];
  });

  const updated = await mutateDB((db2) => {
    const p = getProject(db2, params.id)!;
    p.tasks = tasks;
    p.stage = "schedule";
    p.updatedAt = new Date().toISOString();
    return p;
  });
  return NextResponse.json({ project: updated });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const taskId = body?.taskId as string | undefined;
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const updated = await mutateDB((db) => {
    const p = getProject(db, params.id);
    if (!p) return null;
    const task = p.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    if (typeof body.status === "string" && ["todo", "doing", "done"].includes(body.status)) {
      task.status = body.status;
    }
    if (Array.isArray(body.checklist)) {
      task.checklist = body.checklist;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      task.title = body.title.trim();
    }
    if (typeof body.priority === "string" && ["high", "medium", "low"].includes(body.priority)) {
      task.priority = body.priority;
    }
    if (typeof body.comment === "string" && body.comment.trim()) {
      task.comments.push({ author: user.name, text: body.comment.trim(), at: new Date().toISOString() });
    }
    p.updatedAt = new Date().toISOString();
    return p;
  });

  if (!updated) return NextResponse.json({ error: "Project or task not found" }, { status: 404 });
  return NextResponse.json({ project: updated });
}
