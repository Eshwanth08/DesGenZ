import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata = { title: "DesGenZ" };

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  return redirect(session.role === "hr" ? "/hr" : "/workspace");
}
