"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Badge, Stat } from "@/components/ui";
import { api } from "@/lib/client";
import MessagesPanel from "@/components/MessagesPanel";

interface HRUser {
  id: string;
  name: string;
  email: string;
  role: "hr" | "employee";
  projectCount: number;
  activeCount: number;
  avgFeasibility: number | null;
}

interface ProjectRef {
  id: string;
  name: string;
  assignedTo: string;
}

interface AnalyticsShape {
  totalProjects: number;
  activeProjects: number;
  approvedProjects: number;
  avgComplexity: number;
  avgFeasibility: number;
  reworkCount: number;
  delayedCount: number;
  completionRate: number;
}

export default function HRDashboard() {
  const [users, setUsers] = useState<HRUser[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [meId, setMeId] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ users: HRUser[]; projects: ProjectRef[]; me: string }>("/api/hr/users");
      setUsers(data.users);
      setProjects(data.projects);
      setMeId(data.me);
      setAnalytics(await api<AnalyticsShape>("/api/hr/analytics"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load HR data");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(userId: string, fn: () => Promise<unknown>, done: string) {
    setBusyUser(userId);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyUser(null);
    }
  }

  const changeRole = (u: HRUser, role: string) =>
    run(u.id, () => api("/api/hr/users", { method: "PATCH", body: JSON.stringify({ userId: u.id, role }) }), `${u.name} is now ${role}`);

  const assign = (projectId: string, userId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    if (userId === "unassigned") {
      return run(meId, () => api("/api/hr/users", { method: "PATCH", body: JSON.stringify({ action: "unassign", projectId }) }), `Access to “${p.name}” revoked`);
    }
    const u = users.find((x) => x.id === userId);
    return run(meId, () => api("/api/hr/users", { method: "PATCH", body: JSON.stringify({ action: "assign", projectId, userId }) }), `“${p.name}” assigned to ${u?.name ?? "member"}`);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">People &amp; reporting</h1>
        <p className="text-text-secondary text-sm mt-1">
          HR view — accounts, roles, workload visibility and access control. Employees only see the projects you assign to them.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => void load()} className="shrink-0 underline font-medium">Retry</button>
        </div>
      )}
      {notice && <p className="text-sm text-accent">{notice}</p>}

      {analytics && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Projects" value={analytics.totalProjects} />
          <Stat label="Active" value={analytics.activeProjects} />
          <Stat label="Approved" value={analytics.approvedProjects} tone="success" />
          <Stat label="Completion" value={`${analytics.completionRate}%`} />
          <Stat label="Avg complexity" value={analytics.avgComplexity || "—"} />
          <Stat label="Avg feasibility" value={analytics.avgFeasibility || "—"} tone={analytics.avgFeasibility < 55 ? "warning" : "default"} />
          <Stat label="Rework" value={analytics.reworkCount} tone={analytics.reworkCount > 2 ? "warning" : "default"} />
          <Stat label="Delayed" value={analytics.delayedCount} tone={analytics.delayedCount > 0 ? "warning" : "default"} />
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-3">Team</h2>
        <div className="space-y-2.5">
          {users.map((u) => (
            <Card key={u.id} className="p-4 flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-muted text-accent text-xs font-bold">
                {u.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name}
                  {u.id === meId && <span className="ml-2 text-xs text-text-muted">(you)</span>}
                </p>
                <p className="text-xs text-text-muted">{u.email}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-xs text-text-secondary">Projects</p>
                  <p className="font-semibold">{u.projectCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-secondary">Active</p>
                  <p className="font-semibold">{u.activeCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-secondary">Avg feasibility</p>
                  <p className="font-semibold">{u.avgFeasibility ?? "—"}</p>
                </div>
                <Badge tone={u.role === "hr" ? "blue" : "neutral"}>{u.role}</Badge>
                <select
                  value={u.role}
                  disabled={busyUser === u.id || u.id === meId}
                  title={u.id === meId ? "You can't change your own role" : "Change role"}
                  onChange={(e) => changeRole(u, e.target.value)}
                  className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Role for ${u.name}`}
                >
                  <option value="employee">employee</option>
                  <option value="hr">hr</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <MessagesPanel meId={meId} />

      <section>
        <h2 className="font-semibold mb-1">Access control</h2>
        <p className="text-text-secondary text-sm mb-3">
          Decide who works on what — employees see only the projects assigned here.
        </p>
        <div className="space-y-2.5">
          {projects.length === 0 && <p className="text-sm text-text-secondary">No projects yet.</p>}
          {projects.map((p) => {
            const current = users.find((u) => u.id === p.assignedTo);
            return (
              <Card key={p.id} className="p-4 flex flex-wrap items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-bg-faint text-text-secondary text-xs font-bold">pr</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-text-muted">
                    {current ? `Assigned to ${current.name}` : "Unassigned — no employee can see it"}
                  </p>
                </div>
                <select
                  value={p.assignedTo || "unassigned"}
                  disabled={busyUser === meId}
                  onChange={(e) => assign(p.id, e.target.value)}
                  className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary"
                  aria-label={`Assign project ${p.name}`}
                >
                  <option value="unassigned">Unassigned</option>
                  {users
                    .filter((u) => u.role === "employee")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
