# DesGenZ

AI-assisted design project pipeline for solo designers — from requirement document to client delivery, in 12 stages.

Built from `desgenz-build-spec.md` (stack, design system, roles) and `designos-build-pipeline.md` (stages, MoSCoW scope).

## Quick start

```bash
npm install
npm run dev        # → http://localhost:3000
```

Demo accounts (seeded automatically):

| Role | Email | Password |
|---|---|---|
| Designer (employee) | `designer@desgenz.app` | `demo-employee` |
| HR | `hr@desgenz.app` | `demo-hr` |

## Supabase (client database)

The data layer is dual-mode. Paste your project's credentials into `.env.local` and it switches to Postgres automatically — no code changes:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>   # server-side only
```

1. Create the tables once: open **Supabase Dashboard → SQL Editor**, paste `supabase/supabase-setup.sql`, run it. (Idempotent — safe to re-run.)
2. Copy the **Project URL** and **service_role key** from **Project Settings → API** into `.env.local` (see `.env.example`).
3. Restart the dev server. Verify mode at `http://localhost:3000/api/store-status` → `{"store":"supabase",...}`.

Behavior:
- On first cloud connection the app seeds the demo users and **adopts any locally-created projects** into Supabase so nothing is lost.
- If Supabase is unreachable at any point the app falls back to the local JSON store and logs the reason — it never hard-fails.
- The service_role key bypasses RLS and is used **only in server code**; RLS policies in the SQL file fail closed against anon/authenticated access.
- Check connection status anytime at `/api/store-status`.

## What's implemented

| Stage | Feature | Status |
|---|---|---|
| 1 — Requirement Intake | AI Requirement Analyzer (paste doc → structured extraction → **human-in-the-loop confirm/edit**) | ✅ Must |
| 2 — Workspace Creation | Auto-created from confirmed requirements; one workspace = one project | ✅ Must |
| 3 — Intelligence Scoring | Complexity / Deadline feasibility / Budget realism, always with visible reasoning | ✅ Must (simplified per spec) |
| 4 — Task Generation | AI task list with priorities, dependencies, checklists, comments | ✅ Must |
| 5 — Scheduling | Milestone plan paced by the feasibility score | ✅ Should |
| 6 — Design Draft Generation | Structural draft (pages, sections, palette, typography) with pricing-tier depth (starter 3 / standard 6 / premium 10 screens); optional Figma MCP push | ✅ Must + Should |
| 7 — Internal Design Review | Annotations with resolve/reopen; submit blocked while issues are open | ✅ Must |
| 8 — Client Approval | Send to client → approve / request changes; re-entry into review loop | ✅ Must |
| 9 — Version Tracking | Version entries on regenerate/send; approval history | ✅ Should |
| 10 — Client Portal | Shared-token link (no client login): progress, draft preview, approve/request changes | ✅ Should |
| 11 — Delay / Risk | Surfaces as low-feasibility flags in Stage 3 + analytics (per spec: output of Stage 3, not a separate system) | ✅ as scoped |
| 12 — Basic Analytics | Completion rate, rework, delay counts — workspace + HR views | ✅ Could |
| HR role | People directory, roles, workload visibility, basic reporting | ✅ |
| Responsive | Mobile bottom-nav, tablet two-pane, desktop sidebar, ≤1400px content cap | ✅ |
| Touch review | Draft viewer supports pinch-zoom and touch-drag (iPad-first requirement) | ✅ |

Explicitly cut per spec (Won't-have): RBAC/SSO/audit logs, enterprise collaboration, meeting assistant, executive dashboard, full animation generation, multi-tool MCP.

## AI engines

The pipeline runs **fully offline** out of the box using a deterministic heuristic engine — every AI output is labeled with the engine that produced it.

To upgrade to real LLM extraction/reasoning, add to `.env.local`:

```
GEMINI_API_KEY=your_key        # https://aistudio.google.com/apikey
```

With a key present, Stages 1/3/6 call **Gemini 2.5 Flash** (free tier) and automatically fall back to the heuristic engine on rate limits or errors (logged, never silent). Same pattern for Figma MCP in Stage 6:

```
FIGMA_MCP_ENDPOINT=https://your-mcp-server/figma
FIGMA_MCP_TOKEN=your_token
```

When configured, "Push to Figma (MCP)" sends the draft plan (pages, palette, typography) to your MCP endpoint; without it, the structural draft renders in-app.

## Architecture

```
app/                 Next.js App Router
  (auth)/login       Role-based login
  workspace/         Designer pipeline (12-stage screens per project)
  hr/                People + reporting
  portal/[token]     Client shared-link view
  api/               Analyze, projects, tasks, schedule, draft, review, approval, portal, hr, store-status
components/          UI kit, AppShell, DraftCanvas (touch/zoom viewer)
lib/                 types, store (dual-mode: Supabase / JSON), supabase client, auth/session, llm engines
supabase/            supabase-setup.sql (schema + RLS)
styles/tokens.css    Section 3 design tokens as CSS variables (light + dark)
```

- **Persistence:** dual-mode — Supabase Postgres when configured (see above), otherwise a JSON file at `data/db.local.json` (seeded on first run). Both modes share the same `Project` document shape, so business logic never changes.
- **Design system:** spec Section 3 tokens are wired into both `tailwind.config.ts` and `styles/tokens.css`; animation rules (150/250/350ms, standard/bounce easing, transform+opacity only) live in `components/motion.ts`.
- **Security notes (demo-grade):** session tokens use a deterministic dev signature (`DESGENZ_SECRET` env var overrides), passwords are demo-convention based, and the portal authorizes by unguessable token. The Supabase service key never reaches the client. Fine for local/solo use — replace with Supabase auth + RLS-backed sessions before real client data.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # serve production build
npm run typecheck   # tsc --noEmit
```
