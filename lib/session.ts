import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, type SessionUser } from "./auth";

export const SESSION_COOKIE = "dgz_session";

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: "hr" | "employee"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === "hr" ? "/hr" : "/workspace");
  return user;
}
