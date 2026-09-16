import type { Config } from "tailwindcss";

/**
 * Every color maps to a CSS variable (RGB triplet) from styles/tokens.css, so
 * switching [data-theme="light"|"dark"] on <html> re-themes the whole app.
 * Opacity modifiers (bg-black/10 etc.) keep working because the variables are
 * triplets consumed via rgb(var(--x) / <alpha-value>).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "rgb(var(--bg-base) / <alpha-value>)",
          surface: "rgb(var(--bg-surface) / <alpha-value>)",
          faint: "rgb(var(--bg-faint) / <alpha-value>)",
        },
        border: {
          subtle: "rgb(var(--border-subtle) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          muted: "rgb(var(--accent-muted) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          contrast: "rgb(var(--accent-contrast) / <alpha-value>)",
          // Legacy blue names kept so existing markup renders in theme colors.
          blue: "rgb(var(--accent) / <alpha-value>)",
          "blue-muted": "rgb(var(--accent-muted) / <alpha-value>)",
          "blue-hover": "rgb(var(--accent-hover) / <alpha-value>)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "success-muted": "rgb(var(--success-muted) / <alpha-value>)",
        "warning-muted": "rgb(var(--warning-muted) / <alpha-value>)",
        "danger-muted": "rgb(var(--danger-muted) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "20px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        glass: "var(--shadow-glass)",
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
