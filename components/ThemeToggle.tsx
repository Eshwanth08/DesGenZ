"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("dgz-theme", theme);
  } catch {
    /* private mode — theme just won't persist */
  }
}

/** Inline script string: runs before paint to prevent a light/dark flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('dgz-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle color theme"
      className={`inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-accent-muted hover:text-text-primary ${compact ? "" : "min-w-[92px] justify-center"}`}
    >
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
      {!compact && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
