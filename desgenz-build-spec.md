# DesGenZ — Full Project Build Spec

**Purpose of this document:** single source-of-truth spec for AI-assisted development (Claude Code, Cursor, etc.). Everything an AI coding agent needs — architecture, design tokens, roles, pipeline, LLM choice — lives here so you can hand this file to an agent and start building without re-explaining context.

---

## 0. Name Check

Searched for **"DesGenZ"** across web results, software directories, and trademark-adjacent listings — no existing product, app, or company uses this name (closest unrelated matches were "Desygner," a graphic-design tool, and "DezignDen," a dev agency — neither conflicts). **Name is clear to use.** Standard caveat: this is a web-search check, not a formal trademark search — if you plan to register a trademark or publish to app stores, run a proper USPTO/domain check before committing long-term.

---

## 1. Tech Stack (free-tier / solo-dev friendly)

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js (React)** | Free, huge AI-assisted-dev support (most coding agents know it well), handles responsive + SSR easily |
| Styling | **Tailwind CSS** | Fast to theme, easy to encode the design tokens below directly as config, free |
| Animation | **Framer Motion** | Best free React animation library for hover/transition/micro-interaction work specified below |
| Auth & DB | **Supabase (free tier)** | Free Postgres DB + built-in auth with role support, generous free tier, avoids building auth from scratch |
| Hosting | **Vercel (free tier)** | Native Next.js support, free SSL, free custom domain support via CNAME |
| Design generation | **Figma MCP** (see Stage 6 of pipeline) | As established — most mature MCP write-back support as of 2026 |
| AI/LLM backend | See **Section 4** below | Powers Requirement Analyzer, Intelligence Engine, and reasoning behind Design Draft Generator |
| File storage | **Supabase Storage (free tier)** | Bundled with the DB choice above, avoids a second service |

---

## 2. User Roles & Auth

Three login types, as requested:

| Role | Access | Notes |
|---|---|---|
| **HR** | Employee accounts, roles/permissions, workload visibility, basic reporting | Admin-adjacent role; manages *people*, not project content |
| **Employee (Designer/PM)** | Full pipeline access: requirement intake → design draft → review → approval → client portal | Primary daily-use role |
| **LLM / AI Service** | Not a human login — a scoped **service account** (API key + role, not a password login) used internally by the app's backend to call the Requirement Analyzer, Intelligence Engine, and MCP Design Generator on the user's behalf | Keep this scoped tightly: read/write only to the specific project record it's invoked on, never global DB access |

**Implementation note:** use Supabase's row-level security (RLS) policies to enforce this — HR sees people-data tables, Employees see project tables scoped to their assigned projects, the LLM service role uses a server-side key that never reaches the client.

Keep it to these three roles for v1. Don't add Manager/Executive/Client-login tiers yet — that's enterprise-scale RBAC you flagged as a "Won't-have" in the earlier pipeline doc, and it still applies.

---

## 3. Design System

**Theme direction:** light gray / near-white base, near-black text, muted (not saturated) blue as the single accent color, with translucent/glass surfaces used sparingly for elevated panels (modals, cards on top of content).

### Color Tokens

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#F6F6F7` | Page background (near-white light gray) |
| `bg-surface` | `#FFFFFF` | Cards, panels, sidebars |
| `bg-surface-glass` | `rgba(255,255,255,0.65)` + `backdrop-blur: 16px` | Translucent panels — modals, floating toolbars, nav overlays |
| `border-subtle` | `#E4E4E7` | Card borders, dividers |
| `border-glass` | `rgba(0,0,0,0.06)` | Border on translucent surfaces |
| `text-primary` | `#111113` | Headings, primary text (near-black, not pure black — softer on eyes) |
| `text-secondary` | `#5B5D66` | Body copy, secondary labels |
| `text-muted` | `#9A9CA5` | Placeholder text, disabled states |
| `accent-blue` | `#4C6EF5` | Primary buttons, active states, links — **use sparingly**, only for the single most important action per screen |
| `accent-blue-muted` | `#EEF1FE` | Blue-tinted backgrounds (selected rows, subtle highlights) — avoids the "too bright" problem while keeping the blue identity |
| `accent-blue-hover` | `#3D5BD9` | Hover/active state of primary blue elements |
| `success` | `#3FA66B` | Approvals, completed states — desaturated green, not neon |
| `warning` | `#D8934C` | Risk/delay flags — muted amber, not alarm-red |
| `danger` | `#D14D4D` | Errors, rejected states — desaturated red |

**Dark-mode variant (optional, build after light mode is solid):**
`bg-base: #17181C`, `bg-surface: #1F2024`, `text-primary: #F2F2F3`, `text-secondary: #A3A5AD`, keep `accent-blue` the same for brand consistency, `bg-surface-glass: rgba(24,24,27,0.65)`.

### Typography
- Font: **Inter** (free, excellent AI-agent/Tailwind support, reads cleanly at small sizes on mobile)
- Weights: 400 (body), 500 (labels/buttons), 600 (headings), 700 (page titles only)
- Base size: 15px body (16px on desktop breakpoint), scale up via `1.25` type ratio for headings

### Spacing & Radius
- Base spacing unit: **4px** (use Tailwind's default scale — 4/8/12/16/24/32/48/64)
- Border radius: `8px` (inputs, small buttons), `12px` (cards), `20px` (modals, glass panels — softer radius reinforces the translucent/light feel)

### Shadows
Keep shadows soft and low-opacity — matches the light gray/near-white theme, avoids a harsh look:
- `shadow-sm`: `0 1px 2px rgba(0,0,0,0.04)` — default card resting state
- `shadow-md`: `0 4px 12px rgba(0,0,0,0.08)` — hovered card / raised element
- `shadow-glass`: `0 8px 32px rgba(0,0,0,0.10)` — translucent modal/panel elevation

---

## 4. Animation & Hover Interaction Spec

**Global animation rules:**
- Duration: **150ms** for micro-interactions (button hover, input focus), **250ms** for panel/modal transitions, **350ms** for page-level transitions
- Easing: standard ease `cubic-bezier(0.4, 0, 0.2, 1)` for most transitions; use `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot) only for playful confirmation moments (e.g., approval checkmark) — don't overuse the bounce, it should feel rare/rewarding
- Animate **transform and opacity only** where possible (not width/height/top/left) — keeps it smooth on lower-powered iPads/phones

**Hover component behaviors (desktop only — see responsive note below):**
- **Buttons:** background shifts to `accent-blue-hover`, subtle `scale(1.02)`, 150ms
- **Cards (project cards, draft previews):** lift via `shadow-sm → shadow-md`, `translateY(-2px)`, 200ms
- **Nav items:** background fades to `accent-blue-muted`, text color shifts to `accent-blue`, 150ms
- **Glass panels:** on hover, increase blur slightly (`16px → 20px`) and opacity (`0.65 → 0.75`) for a subtle "focus" feel — use tastefully, not on every panel

**Mobile/touch note:** hover states don't exist on touch devices — replace with a brief `active:scale(0.98)` tap-feedback state instead, so the interface still feels responsive on iPad/phone without relying on a hover event that will never fire.

---

## 5. Responsive Requirements

Full responsive support across **phone, iPad (tablet), and desktop** — build mobile-first, then scale up.

| Breakpoint | Range | Notes |
|---|---|---|
| Mobile | `< 640px` | Single-column layout, bottom nav bar instead of sidebar, collapse tables into stacked cards |
| Tablet (iPad) | `640px – 1024px` | Two-column layout where relevant (e.g., task list + detail pane); **test both portrait and landscape iPad orientation explicitly** — iPad's aspect ratio breaks a lot of "just scaled desktop" layouts |
| Desktop | `> 1024px` | Full sidebar nav, multi-column dashboard, hover states fully active |
| Wide desktop | `> 1440px` | Cap main content width (e.g., `max-w-[1400px]`) and center it — don't let cards/text stretch edge-to-edge on large monitors |

**iPad-specific requirement:** the Design Review System (Stage 7) and Design Draft viewer (Stage 6) should support pinch-to-zoom / touch-drag for reviewing design drafts — this is the one screen iPad users will spend the most time on, so it deserves explicit touch-gesture handling, not just a scaled-down desktop view.

---

## 6. LLM Selection (free tier)

Two real options depending on what you're optimizing for — pick based on your priority:

### Option A — Easiest to set up, strong general + reasoning: **Google Gemini API (Gemini 2.5 Flash), free tier**
- No credit card required, generous free-tier limits, up to 1M token context.
- Best fit for the **Requirement Analyzer** and **Intelligence Engine** stages — these are reasoning/extraction tasks (reading a document, pulling structured fields, scoring feasibility), not raw visual-design generation, so a strong general-purpose free model is the right fit.
- Caveat: Google's 2026 terms route free-tier usage toward "business use" and may use prompts for training outside the EEA/UK/Switzerland — fine for non-sensitive project data, worth knowing if client documents contain confidential material.

### Option B — Best free/open model specifically for design & frontend generation: **Kimi K3**
- Per current design-generation benchmarks (Design Arena Elo, Sept 2026), Kimi K3 ranks **#2 overall** for design/frontend generation, and is the **highest-rated open-weight model** on that board — meaning it's downloadable and self-hostable at zero ongoing API cost, not just "free tier with limits."
- Best fit if you want the LLM itself reasoning about layout/visual choices (e.g., suggesting palette or component structure *before* it's handed to Figma's MCP), rather than only using it for text extraction.
- Tradeoff: self-hosting requires more setup than an API call — needs either your own GPU access or a free-tier host that serves Kimi K3 (check current availability on providers like OpenRouter or Groq, since free-hosted model catalogues shift often).

**Recommendation for v1:** use **Gemini 2.5 Flash free tier** for Stages 1 & 3 (Requirement Analyzer, Intelligence Engine) since those are reasoning-heavy and Gemini's free tier is the most frictionless to integrate. If/when you want the LLM contributing design judgment (not just extraction) ahead of the Figma MCP step, evaluate Kimi K3 as a second model in the pipeline rather than replacing Gemini — use the right model for each job instead of one model for everything.

---

## 7. Development Pipeline (carried over, still the build order)

```
[1] Requirement Intake (AI Requirement Analyzer — Gemini 2.5 Flash)
        ↓
[2] Project Workspace Creation
        ↓
[3] Project Intelligence Scoring (simplified — Gemini 2.5 Flash)
        ↓
[4] Task Generation
        ↓
[5] Scheduling
        ↓
[6] Design Draft Generation (MCP → Figma, optionally Kimi K3-assisted reasoning)
        ↓
[7] Internal Design Review (touch/pinch-zoom on iPad — see Section 5)
        ↓
[8] Client Approval Workflow
        ↓
[9] Version Tracking
        ↓
[10] Client Portal Delivery
        ↓
[11] Delay / Risk Monitoring (feeds back into 3 & 5)
        ↓
[12] Basic Analytics
```

Requirement levels (Must/Should/Could/Won't) for each stage are unchanged from the prior pipeline doc — refer to that breakdown for scope-in/scope-out decisions per feature. This document adds the *how* (stack, design system, roles, LLM); that one has the *what/when*.

---

## 8. Suggested Folder Structure (for AI coding agents)

```
/desgenz
  /app                      # Next.js app router
    /(auth)                 # login, role-based redirect
    /hr                     # HR-role screens
    /workspace              # Employee-role: project pipeline screens
      /[projectId]
        /intake
        /intelligence
        /tasks
        /schedule
        /draft               # Stage 6 — MCP design draft viewer, touch/zoom support
        /review
        /approval
        /portal              # Client-facing view
  /components
    /ui                      # Buttons, cards, inputs — themed per Section 3 tokens
    /motion                  # Shared Framer Motion variants per Section 4
  /lib
    /llm                     # Gemini + (optional) Kimi K3 client wrappers
    /mcp                     # Figma MCP integration
    /supabase                # DB client, RLS-aware query helpers
  /styles
    tokens.css                # Section 3 color/spacing/radius tokens as CSS variables
  /docs
    build-pipeline.md         # prior pipeline doc
    build-spec.md              # this file
```

---

## 9. Non-Functional Notes

- **Accessibility:** even with the muted palette, keep text-on-background contrast at WCAG AA minimum (`text-secondary` on `bg-base` should be checked — it's close to the line; verify with a contrast checker before shipping).
- **Performance on iPad:** avoid heavy blur-everywhere glassmorphism — limit `backdrop-blur` to 1–2 elevated surfaces per screen, not every card, or older iPads will show scroll jank.
- **LLM cost/rate-limit awareness:** free-tier limits (Gemini and any Kimi K3 host) will throttle under real usage — log and surface rate-limit errors gracefully in the UI rather than failing silently, since this is a real constraint at your current stage.
