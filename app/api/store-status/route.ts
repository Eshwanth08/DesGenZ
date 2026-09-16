import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { isCloudMode, readDB } from "@/lib/store";

export async function GET() {
  const db = await readDB();
  const cloud = await isCloudMode();
  return NextResponse.json({
    store: cloud ? "supabase" : "local-json",
    supabaseConfigured: supabaseConfigured(),
    auth: cloud ? "supabase-auth" : "demo-local",
    users: db.users.length,
    projects: db.projects.length,
  });
}
