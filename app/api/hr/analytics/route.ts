import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analytics, readDB } from "@/lib/store";

/** HR-only rollup of pipeline health (spec §2: HR sees people-data + reporting). */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "hr") {
    return NextResponse.json({ error: "HR access required" }, { status: 403 });
  }
  const db = await readDB();
  return NextResponse.json(analytics(db));
}
