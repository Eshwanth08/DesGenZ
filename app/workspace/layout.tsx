import { requireRole } from "@/lib/session";
import AppShell from "@/components/AppShell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("employee");
  return <AppShell user={user}>{children}</AppShell>;
}

export const dynamic = "force-dynamic";
