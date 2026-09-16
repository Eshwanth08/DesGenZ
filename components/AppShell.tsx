"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import type { SessionUser } from "@/lib/session-token";

const EMPLOYEE_NAV = [
  { href: "/workspace", label: "Dashboard", icon: "▦" },
  { href: "/workspace/new", label: "New project", icon: "＋" },
];

const HR_NAV = [
  { href: "/hr", label: "People", icon: "▦" },
];

export default function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = user.role === "hr" ? HR_NAV : EMPLOYEE_NAV;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border-subtle bg-bg-surface px-4 py-6">
        <BrandMark />
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <ThemeToggle />
          <UserCard user={user} onLogout={logout} />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 glass px-4 py-3 flex items-center justify-between">
        <BrandMark compact />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <UserCard user={user} onLogout={logout} compact />
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 pb-24 lg:pb-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass flex justify-around px-2 py-2">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active ? "bg-accent-muted text-accent" : "text-text-secondary"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-contrast text-sm font-bold">D</span>
      {!compact && <span className="font-semibold tracking-tight">DesGenZ</span>}
    </Link>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active ? "bg-accent-muted text-accent" : "text-text-secondary hover:bg-accent-muted hover:text-accent"
      }`}
    >
      <span aria-hidden className="w-4 text-center">{icon}</span>
      {label}
    </Link>
  );
}

function UserCard({ user, onLogout, compact = false }: { user: SessionUser; onLogout: () => void; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "rounded-lg border border-border-subtle p-3"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-muted text-accent text-xs font-bold">
        {user.name.slice(0, 2).toUpperCase()}
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-text-muted capitalize">{user.role}</p>
        </div>
      )}
      <button onClick={onLogout} className="ml-auto text-xs text-text-muted hover:text-danger transition-colors duration-150">
        {compact ? "Exit" : "Log out"}
      </button>
    </div>
  );
}
