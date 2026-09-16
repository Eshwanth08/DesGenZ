"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "./types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ project: Project }>(`/api/projects/${id}`);
      setProject(data.project);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (path: string, body?: unknown, method: "POST" | "PATCH" = "POST") => {
      setBusy(true);
      try {
        const data = await api<{ project: Project }>(path, { method, body: JSON.stringify(body ?? {}) });
        setProject(data.project);
        setError(null);
        return data.project;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Action failed";
        setError(msg);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { project, error, busy, refresh, act, setProject };
}
