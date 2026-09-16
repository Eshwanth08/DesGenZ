import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, newId, readDB } from "@/lib/store";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await readDB();
  const project = getProject(db, params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.tasks.length === 0) {
    return NextResponse.json({ error: "Generate tasks before scheduling" }, { status: 400 });
  }

  const feasibility = project.intelligence?.feasibility ?? 65;
  const pace = feasibility >= 70 ? 3 : feasibility >= 55 ? 4 : 5; // days per task
  const buffer = feasibility < 55 ? 8 : 4;

  const milestones: { id: string; name: string; startDay: number; endDay: number; taskIds: string[] }[] = [];
  let cursor = 1;
  const chunkSize = Math.max(1, Math.ceil(project.tasks.length / 3));
  for (let i = 0; i < project.tasks.length; i += chunkSize) {
    const chunk = project.tasks.slice(i, i + chunkSize);
    const start = cursor;
    const end = cursor + chunk.length * pace - 1;
    milestones.push({
      id: newId("m"),
      name:
        i === 0
          ? "Direction & system locked"
          : i + chunkSize < project.tasks.length
            ? "Drafts produced"
            : "Final delivery",
      startDay: start,
      endDay: end,
      taskIds: chunk.map((t) => t.id),
    });
    cursor = end + 1;
  }
  milestones.push({
    id: newId("m"),
    name: "Client approval & buffer",
    startDay: cursor,
    endDay: cursor + buffer,
    taskIds: [],
  });

  const updated = await mutateDB((db2) => {
    const p = getProject(db2, params.id)!;
    p.milestones = milestones;
    p.stage = "draft";
    p.updatedAt = new Date().toISOString();
    return p;
  });
  return NextResponse.json({ project: updated });
}
