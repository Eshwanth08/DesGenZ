import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  return NextResponse.json({ user });
}

export async function POST() {
  return NextResponse.json({ error: "Use /api/auth/login" }, { status: 405 });
}
