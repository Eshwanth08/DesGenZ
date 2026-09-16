import { NextResponse } from "next/server";
import { encodeSession } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("dgz_session", "", { path: "/", maxAge: 0 });
  void encodeSession;
  return res;
}
