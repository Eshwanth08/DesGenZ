# [Working Title] Design Project Pipeline — Build Spec

> ⚠️ **Naming note:** "DesignOS" and "Designer OS" are already used by existing products (an interior-design PM tool, a Notion template, and a GitHub dev-handoff tool). Rename before public launch. This doc uses **[Working Title]** as a placeholder — replace throughout once you've picked a name.

**Type:** Personal / solo project, built on free-tier tools
**Requirement levels follow MoSCoW:**
- **M** = Must-have (MVP — build first, the pipeline doesn't work without it)
- **S** = Should-have (build right after MVP proves the core loop)
- **C** = Could-have (build later, only adds value once the above works and/or once you have a team or real users)
- **W** = Won't-have for now (explicitly cut — either commodity, out of scope for a solo/free-tier project, or premature)

---

## Pipeline Overview

```
[1] Requirement Intake
        ↓
[2] Project Workspace Creation
        ↓
[3] Project Intelligence Scoring
        ↓
[4] Task Generation
        ↓
[5] Scheduling
        ↓
[6] Design Draft Generation (MCP)
        ↓
[7] Internal Design Review
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

Everything below is organized in this order. Build top to bottom — each stage depends on the one(s) before it.

---

## Stage 1 — Requirement Intake
**Feature: AI Requirement Analyzer** — **[M]**

- Accepts client requirement documents: PDF, DOCX, plain text (images/PPT can be **[C]**, add later — OCR adds complexity).
- Extracts via LLM call:
  - Objectives
  - Deliverables
  - Constraints
  - Deadlines
  - **Budget / pricing tier** (needed for Stage 6 scope logic)
  - Risks
  - Missing information (flag explicitly — don't silently guess)
- Output: a structured JSON object — this is the single source of truth that every later stage reads from.
- **Human-in-the-loop requirement:** show the extracted fields to the user for confirmation/edit before anything downstream runs. Never auto-proceed on unconfirmed extraction — LLM extraction errors compound badly if unchecked.

---

## Stage 2 — Project Workspace Creation
**Feature: Smart Project Workspace** — **[M]**

- Auto-created from the confirmed Stage 1 output.
- Stores: client info, requirements, timeline, budget, deliverables, assets, history — all in one record.
- Keep the data model simple for v1: one workspace = one project. Don't build multi-workspace/org hierarchy yet — unnecessary for a solo project.

---

## Stage 3 — Project Intelligence Scoring
**Feature: AI Project Intelligence Engine (simplified)** — **[M]**

- Start with **2–3 scores only**, not the full five from the original concept:
  - Complexity Score
  - Deadline Feasibility Score
  - (optional third: Budget-Realism Score)
- Skip for v1: Workload Score, full Risk Score, Project Health Score — these need historical data across many past projects to be trustworthy, which a new solo project doesn't have yet. Add them once you've logged real project outcomes.
- Always show the reasoning/basis for the score (e.g. "based on X deliverables and Y-day timeline"), not just a bare number — builds trust and gives you a debugging trail.

**Feature: AI Priority Engine** — **[W]** *(cut/merge)*
- Fold into the Intelligence Engine's output rather than building as a separate module. Not enough scale (one designer, one queue) to need independent prioritization logic yet.

---

## Stage 4 — Task Generation
**Feature: Intelligent Task Management** — **[M]**

- Auto-generate a task list from the confirmed requirements (AI-generated subtasks).
- Core fields only: title, priority, dependency, checklist, comments, file attachment.
- Recurring tasks — **[C]**, skip for v1.

---

## Stage 5 — Scheduling
**Feature: AI Auto Scheduler** — **[S]**

- Generate a rough timeline/milestone plan from tasks + Stage 3 feasibility score.
- Auto-adjustment when deadlines/scope change — **[S]**, build once the static version works.
- Full team schedule / individual work plans across multiple people — **[C]**, only relevant once you're not working solo.

---

## Stage 6 — Design Draft Generation (core differentiator)
**Feature: MCP Design Draft Generator** — **[M]**

- Takes Stage 1's confirmed requirements + budget tier as input.
- Connects via **MCP to Figma** (most mature MCP support as of 2026 — build this integration first, not multi-tool).
- v1 scope, in order of feasibility:
  - **[M]** Layout structure, page composition, basic components, color palette, typography — reliably generatable via Figma's MCP write-back today.
  - **[S]** Pricing-tier logic: map budget tier → number of screens / component depth generated (this is your differentiator — build it deliberately, don't skip it for a generic "one size" draft).
  - **[C]** Suggested interaction/animation notes (not full animation build) — Figma's "Add Interactions" AI can propose a prototype flow; treat this as an assist, not autonomous output.
  - **[W]** Full animation/motion generation, cursor behavior, complex sliding transitions — not reliably automatable yet; keep this manual/designer-owned for now.
- Other design tools (Adobe, Canva, Sketch) via MCP — **[W]** for now; their AI-agent write access isn't mature enough yet. Revisit as their MCP support matures.
- Always label output clearly as a **rough/structural first pass**, not a finished design, both in the UI and to the client.

---

## Stage 7 — Internal Design Review
**Feature: Design Review System** — **[M]**

- Visual annotations on the generated draft.
- Voice/video feedback — **[C]**, text/annotation comments are enough for v1.
- AI feedback summaries — **[C]**.

---

## Stage 8 — Client Approval Workflow
**Feature: Smart Approval Workflow** — **[M]**

- Simple flow: Draft → Client Review → Approved / Change Requested.
- Skip the full multi-role chain (Designer → Team Lead → Manager → Client) for a solo project — go straight Designer/You → Client.
- Fast re-generation loop at the rough-draft stage matters more than a formal approval chain — prioritize speed of iteration over process depth here.

---

## Stage 9 — Version Tracking
**Feature: Version Control** — **[S]**

- Track revisions of the draft/approved design and requirement changes.
- Keep to metadata + snapshots, not a full VCS — you're not replacing Figma's own version history, just linking it to your project record.

---

## Stage 10 — Client Portal Delivery
**Feature: Client Portal** — **[S]**

- Client can view progress, approve/request revisions, download deliverables, track milestones.
- Keep to a simple shared-link view for v1 rather than a full separate login system, if your free-tier stack makes auth costly.

---

## Stage 11 — Delay / Risk Monitoring
**Feature: AI Delay Predictor** — **[C]**

- Feeds back into Stage 3 (Intelligence Engine) and Stage 5 (Scheduler) once there's real progress data to monitor against.
- Don't build as a standalone feature — it's an output of Stage 3, not a separate system.

---

## Stage 12 — Basic Analytics
**Feature: Enterprise Analytics (lightweight)** — **[C]**

- Simple counts: completion rate, delay frequency, rework count.
- Full "Enterprise Analytics" suite (client satisfaction tracking, AI efficiency metrics) — **[W]** for now, needs multiple clients/projects worth of data to mean anything.

---

## Cross-Cutting (not sequential — needed throughout, not as pipeline stages)

| Feature | Level | Note |
|---|---|---|
| Basic auth (login, single role) | **M** | No RBAC complexity needed solo |
| Figma MCP integration | **M** | This is the technical backbone of Stage 6 |
| AI Design Assistant (palettes/typography suggestions) | **S** | Fold into Stage 6 rather than a separate module |
| AI Knowledge Engine (search across past projects/assets) | **C** | Valuable once you have enough past-project history to search |
| AI Resource Optimizer | **C** | Only meaningful once you're not working solo |
| Role-based access control, SSO, audit logs | **W** | Irrelevant without enterprise clients; revisit if you take on a team or enterprise customer |
| Compliance certs (SOC 2 / ISO 27001) | **W** | Expensive, slow, unnecessary pre-revenue |
| Enterprise Collaboration Hub (chat/voice/video) | **W** | Use existing free tools (Slack/Discord/Meet) instead of building this |
| AI Meeting Assistant | **W** | Use an existing free transcription tool instead of building this |
| Executive Dashboard | **W** | No exec buyer at solo-project stage |
| Business Impact Intelligence | **W** | Needs mature Stage 3 data history first |
| AI Digital Twin Simulator | **W** | Needs project history you don't have yet; revisit once Stage 3 has track record |
| AI Learning Engine | **W** | This is an emergent outcome of running Stages 3–11 well over time, not a feature to build directly |

---

## Build Order Summary (for your own sprint planning)

1. **Sprint 1 (MVP core loop):** Stage 1 → 2 → 4 → 6 (structure only) → 7 → 8
2. **Sprint 2 (intelligence + polish):** Stage 3 (simplified) → 5 → 9 → 10
3. **Sprint 3 (differentiation depth):** Pricing-tier logic in Stage 6, interaction-note assist, Stage 11
4. **Later / only if scaling beyond solo:** Resource Optimizer, Knowledge Engine, full Analytics, RBAC
