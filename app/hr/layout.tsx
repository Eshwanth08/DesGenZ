import { requireRole } from "@/lib/session";
import AppShell from "@/components/AppShell";

export default async function HRLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("hr");
  return <AppShell user={user}>{children}</AppShell>;
}
