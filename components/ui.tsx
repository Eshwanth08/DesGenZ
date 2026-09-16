"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { forwardRef } from "react";

export function Card({ children, className = "", hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={`bg-bg-surface border border-border-subtle rounded-lg shadow-sm ${
        hover ? "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  const styles: Record<string, string> = {
    primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
    secondary: "bg-bg-surface text-text-primary border border-border-subtle hover:bg-accent-muted",
    ghost: "text-text-secondary hover:text-text-primary hover:bg-accent-muted",
    danger: "bg-bg-surface text-danger border border-border-subtle hover:bg-danger-muted",
  };
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`rounded-md text-sm font-medium px-4 py-2 disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
});

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "success" | "warning" | "danger" }) {
  const tones: Record<string, string> = {
    neutral: "bg-bg-faint text-text-secondary",
    blue: "bg-accent-muted text-text-primary",
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning",
    danger: "bg-danger-muted text-danger",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { tone: "neutral" | "blue" | "success" | "warning"; label: string }> = {
    intake: { tone: "neutral", label: "Intake" },
    intelligence: { tone: "blue", label: "Intelligence" },
    tasks: { tone: "blue", label: "Tasks" },
    schedule: { tone: "blue", label: "Scheduling" },
    draft: { tone: "warning", label: "Drafting" },
    review: { tone: "warning", label: "In review" },
    approval: { tone: "warning", label: "Awaiting approval" },
    versions: { tone: "success", label: "Versioned" },
    portal: { tone: "success", label: "Delivered" },
  };
  const item = map[stage] ?? { tone: "neutral" as const, label: stage };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border-subtle rounded-lg p-10 text-center">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary mt-1">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones: Record<string, string> = {
    default: "text-text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
    </Card>
  );
}

export function NavCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg border border-border-subtle bg-bg-surface shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {children}
    </Link>
  );
}
