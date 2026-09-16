import Link from "next/link";
import { requireRole } from "@/lib/session";
import { analytics, readDB } from "@/lib/store";
import { Card, Stat, StageBadge, EmptyState } from "@/components/ui";
import MessagesPanel from "@/components/MessagesPanel";
import NewProjectButton from "./NewProjectButton";

export const dynamic = "force-dynamic";

export default async function WorkspaceDashboard() {
  const user = await requireRole("employee");
  const db = await readDB();

  // §2 scoping: an employee's workspace shows exactly what HR assigned to
  // them — stats are computed over the same scoped set, never the whole team's.
  const shown = db.projects.filter((p) => p.assignedTo === user.id);
  const scopedAnalytics = analytics({ ...db, projects: shown });

  const active = shown.filter((p) => p.stage !== "portal").length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-text-secondary text-sm mt-1">
            Welcome back, {user.name.split(" ")[0]} — {shown.length} project{shown.length === 1 ? "" : "s"} assigned to you.
          </p>
        </div>
        <NewProjectButton />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Assigned" value={shown.length} />
        <Stat label="Active" value={active} />
        <Stat
          label="Avg feasibility"
          value={scopedAnalytics.avgFeasibility || "—"}
          tone={scopedAnalytics.avgFeasibility < 55 ? "warning" : "default"}
        />
        <Stat label="Rework" value={scopedAnalytics.reworkCount} tone={scopedAnalytics.reworkCount > 2 ? "warning" : "default"} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Projects</h2>
        {shown.length === 0 ? (
          <EmptyState
            title="No projects assigned yet"
            hint="Projects appear here once HR assigns them to you. You can also run a requirement document through Stage 1 to start one."
            action={<NewProjectButton />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <Link key={p.id} href={`/workspace/${p.id}`}>
                <Card className="p-4 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{p.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{p.client}</p>
                    </div>
                    <StageBadge stage={p.stage} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
                    <span className="rounded-full bg-accent-muted text-accent px-2 py-0.5 capitalize font-medium">{p.budgetTier}</span>
                    <span className="rounded-full bg-bg-faint px-2 py-0.5">{p.tasks.filter((t) => t.status === "done").length}/{p.tasks.length} tasks</span>
                    <span className="rounded-full bg-bg-faint px-2 py-0.5">{p.drafts.length} draft{p.drafts.length === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-3 text-xs text-text-muted">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MessagesPanel meId={user.id} />
    </div>
  );
}
