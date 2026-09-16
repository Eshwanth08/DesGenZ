import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProject, mutateDB, readDB } from "@/lib/store";
import { scoreProject } from "@/lib/llm";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await readDB();
  const project = getProject(db, params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const result = await scoreProject(project.requirements);
  const updated = await mutateDB((db2) => {
    const p = getProject(db2, params.id)!;
    p.intelligence = result.data;
    p.stage = "tasks";
    p.updatedAt = new Date().toISOString();
    return p;
  });

  return NextResponse.json({ project: updated, engine: result.engine });
}
