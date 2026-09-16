import { NextResponse } from "next/server";
import { registerUser, encodeSession, sanitizeUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role === "hr" ? "hr" : "employee";

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const { user, error } = await registerUser(email, password, name, role);
  if (!user) {
    return NextResponse.json({ error: error ?? "Sign-up failed" }, { status: 400 });
  }

  const res = NextResponse.json({ user: sanitizeUser(user) });
  res.cookies.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
