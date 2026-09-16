"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/lib/client";
import { StageBadge, Badge, Button } from "@/components/ui";

const STEPS = [
  { key: "overview", label: "Overview", href: "" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "schedule", label: "Schedule", href: "/schedule" },
  { key: "draft", label: "Draft", href: "/draft" },
  { key: "review", label: "Review", href: "/review" },
  { key: "approval", label: "Approval", href: "/approval" },
  { key: "versions", label: "Versions", href: "/versions" },
  { key: "portal", label: "Portal", href: "/portal" },
];

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: { projectId: string } }) {
  const pathname = usePathname();
  const { project, error } = useProject(params.projectId);

  const base = `/workspace/${params.projectId}`;
  const current = STEPS.find((s) => pathname === `${base}${s.href}`) ?? STEPS[0];

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-danger">{error}</p>}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {project ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href="/workspace" className="text-text-muted hover:text-text-primary text-sm">←</Link>
                <h1 className="text-xl font-bold tracking-tight truncate">{project.name}</h1>
                <StageBadge stage={project.stage} />
                <Badge tone="blue" >{project.budgetTier} tier</Badge>
              </div>
              <p className="text-sm text-text-secondary mt-0.5">{project.client}</p>
            </>
          ) : (
            <div className="h-8 w-64 rounded bg-bg-faint animate-pulse" />
          )}
        </div>
      </header>

      {project && (
        <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
          {STEPS.map((s) => {
            const active = s.key === current.key;
            return (
              <Link
                key={s.key}
                href={`${base}${s.href}`}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-accent-muted text-accent" : "text-text-secondary hover:bg-accent-muted hover:text-accent"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      )}

      {children}
    </div>
  );
}
