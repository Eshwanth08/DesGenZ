"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { Draft } from "@/lib/types";

const TONE_BG: Record<string, string> = {
  primary: "bg-accent",
  accent: "bg-warning",
  surface: "bg-bg-surface",
  muted: "bg-bg-faint",
};

export default function DraftCanvas({ draft, onCanvasClick }: { draft: Draft; onCanvasClick?: (page: number, x: number, y: number) => void }) {
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const pageData = draft.pages[page];

  // distance between two touches
  const touchDist = (t: React.TouchList) => (t.length >= 2 ? Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) : 0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      pinch.current = { dist: touchDist(e.touches), scale };
      pan.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      pan.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
      touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    }
  }, [scale, offset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2 && pinch.current) {
      const d = touchDist(e.touches);
      const next = Math.max(0.5, Math.min(3, (pinch.current.scale * d) / pinch.current.dist));
      setScale(next);
    } else if (e.touches.length === 1 && pan.current) {
      const t = e.touches[0];
      const dx = t.clientX - pan.current.x;
      const dy = t.clientY - pan.current.y;
      // Keep drag small so taps still land for annotations
      if (Math.abs(dx) + Math.abs(dy) < 8) return;
      setOffset({ x: pan.current.ox + dx, y: pan.current.oy + dy });
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    pinch.current = null;
    pan.current = null;
  }, []);

  function handleSurfaceClick(e: React.MouseEvent, pageNum: number) {
    if (scale !== 1 || offset.x !== 0 || offset.y !== 0) return; // don't annotate while zoomed/panned
    if (!onCanvasClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onCanvasClick(pageNum, x, y);
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-base overflow-hidden">
      {/* Page tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle bg-bg-surface px-2 py-1.5">
        {draft.pages.map((p, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              i === page ? "bg-accent-muted text-accent" : "text-text-secondary hover:bg-accent-muted hover:text-accent"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Zoomable canvas */}
      <div
        className="relative touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="mx-auto my-6 w-[300px] sm:w-[380px]"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "top center", transition: "transform 0.15s cubic-bezier(0.4,0,0.2,1)" }}
        >
          {pageData && (
            <div
              className="rounded-lg border border-border-subtle bg-bg-surface shadow-sm overflow-hidden cursor-crosshair"
              onClick={(e) => handleSurfaceClick(e, page)}
            >
              {/* Page wireframe */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-bg-surface">
                <p className="text-xs font-semibold">{pageData.name}</p>
                <p className="text-[10px] text-text-muted">v{draft.version} · structural</p>
              </div>
              {pageData.sections.map((s, i) => (
                <div key={i} className="relative px-3 py-2 border-b border-border-subtle/60 last:border-0">
                  <div className={`${TONE_BG[s.tone] ?? "bg-bg-faint"} rounded-sm ${s.tone === "primary" || s.tone === "accent" ? "opacity-90" : ""}`} style={{ height: Math.max(8, s.height / 2.2) }}>
                    {s.tone === "primary" && (
                      <div className="h-full flex flex-col justify-center px-2">
                        <div className="h-1.5 w-2/3 rounded bg-bg-surface/80" />
                        <div className="mt-1 h-1 w-1/2 rounded bg-bg-surface/50" />
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-text-muted">{s.name}</p>
                </div>
              ))}

              {/* Annotations overlay */}
            </div>
          )}
        </div>
      </div>

      {/* Zoom + palette + type controls */}
      <div className="border-t border-border-subtle bg-bg-surface px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} className="grid h-7 w-7 place-items-center rounded-md border border-border-subtle text-sm hover:bg-accent-muted" aria-label="Zoom out">−</button>
          <span className="w-12 text-center text-xs text-text-secondary">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(3, s + 0.25))} className="grid h-7 w-7 place-items-center rounded-md border border-border-subtle text-sm hover:bg-accent-muted" aria-label="Zoom in">+</button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="ml-1 text-xs text-text-muted hover:text-accent">Reset</button>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {draft.palette.slice(0, 5).map((c, i) => (
            <span key={i} className="h-5 w-5 rounded-full border border-border-subtle" style={{ background: c }} title={c} />
          ))}
        </div>
        <p className="text-xs text-text-secondary w-full sm:w-auto">
          {draft.typography.heading} / {draft.typography.body} — {draft.typography.note}
        </p>
      </div>
    </div>
  );
}

