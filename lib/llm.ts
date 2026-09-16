import type { AnalysisReport, BudgetTier, Project, RequirementDoc, Task } from "@/lib/types";
import { newId } from "@/lib/store";

/**
 * Heuristic engines that mimic the AI stages. Used as a graceful fallback when
 * GEMINI_API_KEY is not configured — the whole pipeline works offline, and each
 * result is labeled with its engine so results stay trustworthy.
 */

export type EngineName = "gemini-2.5-flash" | "desgenz-heuristic";

export async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );
    if (!res.ok) {
      console.error(`Gemini rate-limit/API error ${res.status} — falling back to heuristic engine`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return text || null;
  } catch (err) {
    console.error("Gemini call failed — falling back to heuristic engine", err);
    return null;
  }
}

/**
 * Drafts a simplified, plain-language report from the raw requirement doc:
 * executive summary, digest sections, and open questions for the client.
 */
export async function draftAnalysisReport(
  rawText: string,
  extracted: ExtractedRequirements
): Promise<AnalysisReport> {
  const prompt = `You are the DesGenZ Report Drafter. A designer attached a client requirement document. Write a SIMPLIFIED report a non-technical stakeholder understands. Return JSON with keys: summary (2-3 sentence executive summary), sections (array of {heading, points: string[]} — e.g. What the client wants, Scope & deliverables, Timeline, Constraints & risks, Money), openQuestions (string[] — what to ask the client before starting). Requirements document:\n\n${rawText.slice(0, 12000)}`;
  const response = await callGemini(prompt);
  if (response) {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Partial<AnalysisReport>;
        return {
          summary: parsed.summary || extracted.projectName,
          sections: Array.isArray(parsed.sections) && parsed.sections.length
            ? parsed.sections
            : heuristicReportSections(extracted),
          openQuestions: parsed.openQuestions ?? extracted.missingInfo,
          engine: "gemini-2.5-flash",
          generatedAt: new Date().toISOString(),
        };
      } catch {
        // fall through to heuristics
      }
    }
  }
  return {
    summary: heuristicSummary(extracted),
    sections: heuristicReportSections(extracted),
    openQuestions: extracted.missingInfo.filter((m) => !/complete/i.test(m)),
    engine: "desgenz-heuristic",
    generatedAt: new Date().toISOString(),
  };
}

function heuristicSummary(e: ExtractedRequirements): string {
  const del = e.deliverables.filter((d) => !/not yet itemized/i.test(d));
  const dl = e.deadlines.find((d) => !/no explicit/i.test(d));
  // "ship before March 20" → "before March 20"; already-dated phrases pass through.
  const dlClean = dl?.replace(/^(?:ship|launch|deliver|go[- ]live|release)\s+/i, "").trim();
  const deadlinePart = !dlClean ? "" : /\b(?:by|before|due)\b/i.test(dlClean) ? `, due ${dlClean.replace(/^by\s+/i, "")}` : ` by ${dlClean}`;
  return `${e.client} needs ${del.length || "several"} deliverable${del.length === 1 ? "" : "s"} (${del.slice(0, 3).join(", ")}${del.length > 3 ? "…" : ""})${deadlinePart}. Budget is the ${e.budgetTier} tier; ${e.missingInfo.some((m) => !/complete/i.test(m)) ? `${e.missingInfo.length} item(s) still need client confirmation.` : "the requirement doc looks complete."}`;
}

function heuristicReportSections(e: ExtractedRequirements): { heading: string; points: string[] }[] {
  return [
    { heading: "What the client wants", points: e.objectives.length ? e.objectives : ["Primary objective to be confirmed at kickoff"] },
    { heading: "Scope & deliverables", points: e.deliverables.length ? e.deliverables : ["To be itemized with the client"] },
    { heading: "Timeline", points: e.deadlines.length ? e.deadlines : ["No hard dates in the document — propose one"] },
    { heading: "Constraints & risks", points: [...e.constraints, ...e.risks].length ? [...e.constraints, ...e.risks] : ["None stated"] },
    { heading: "Money", points: [`Pricing tier: ${e.budgetTier}`, "Final quote pending scope confirmation"] },
  ];
}

export interface ExtractedRequirements {
  projectName: string;
  client: string;
  objectives: string[];
  deliverables: string[];
  constraints: string[];
  deadlines: string[];
  budgetTier: BudgetTier;
  risks: string[];
  missingInfo: string[];
  engine: EngineName;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function bulletsAfter(text: string, keywords: string[]): string[] {
  const lines = text.split(/\n+/);
  let collecting = false;
  const out: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      collecting = true;
      continue;
    }
    if (collecting) {
      if (/^[-•*\d]/.test(line.trim()) && line.trim().length > 3) {
        out.push(line.trim().replace(/^[-•*\d.)\s]+/, ""));
      } else if (line.trim().length > 0 && out.length > 0) {
        break;
      }
    }
  }
  return out;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Trim a sentence to its informative clause (drop leading connectives/bullets). */
function trimClause(s: string): string {
  return s
    .replace(/^[-•*\d.)\s]+/, "")
    .replace(/^(?:and|but|also|however|plus|then|so)\s+/i, "")
    .replace(/^(?:the\s+)?(?:client|customer)\s+(?:also\s+)?/i, "")
    .replace(/\s+are\s+also\s+included[.,!]?\s*$/i, "")
    .replace(/\s+is\s+also\s+included[.,!]?\s*$/i, "")
    .replace(/^(?:they|we)\s+are\s+(?:looking|hoping)\s+for\s+(?:a|an|some)?\s*/i, "")
    .replace(/^(?:they|we)\s+(?:are\s+)?looking\s+(?:for|to)\s+(?:a|an|some)?\s*/i, "")
    // "Acme Robotics needs a brand refresh …" → "a brand refresh …"
    .replace(/^.{2,40}?\s+(?:needs?|wants?|would like)\s+/i, "")
    .replace(/\s*[,;]$|\.$/, "")
    .trim();
}

export async function analyzeRequirements(rawText: string): Promise<ExtractedRequirements> {
  const prompt = `You are the DesGenZ Requirement Analyzer. Extract a JSON object with keys: projectName, client, objectives (string[]), deliverables (string[]), constraints (string[]), deadlines (string[]), budgetTier ("starter"|"standard"|"premium"), risks (string[]), missingInfo (string[]). Missing information must be listed explicitly, never guessed. Requirements document:\n\n${rawText.slice(0, 12000)}`;
  const response = await callGemini(prompt);
  if (response) {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Partial<ExtractedRequirements> & { engine?: string };
        return {
          projectName: parsed.projectName || "Untitled project",
          client: parsed.client || "Unknown client",
          objectives: parsed.objectives ?? [],
          deliverables: parsed.deliverables ?? [],
          constraints: parsed.constraints ?? [],
          deadlines: parsed.deadlines ?? [],
          budgetTier: parsed.budgetTier ?? "standard",
          risks: parsed.risks ?? [],
          missingInfo: parsed.missingInfo ?? [],
          engine: "gemini-2.5-flash",
        };
      } catch {
        // fall through to heuristics
      }
    }
  }

  // ---- Heuristic engine ----
  // Works hard on freeform text before ever resorting to placeholders: mines
  // intent verbs, deliverable nouns, constraint patterns and dates from any
  // sentence, not just tidy bullet sections. Empty result → empty field (the
  // confirm screen stays clean; the customize control adds items).
  const lower = rawText.toLowerCase();
  const allLines = rawText
    .split(/\n+/)
    .map((l) => l.trim().replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 2);
  const sents = sentences(rawText);

  const objectives = dedupe([
    ...bulletsAfter(rawText, ["objective", "goal", "aim"]),
    ...sents
      .filter((s) => /\b(need|needs|want|wants|looking|hoping|goal|aim|objective|increase|improve|reduce|simplify|launch|grow|raise|attract|modernize|refresh)\b/i.test(s))
      .filter((s) => !/\b(must|should|cannot|compliance|ship before|accessib)\b/i.test(s))
      .map((s) => trimClause(s))
      .filter((s) => s.length > 8 && s.length < 140),
  ]).slice(0, 8);

  const DELIVERABLE_NOUNS = /\b(website|web ?site|site|web ?app|app|application|landing page|page|pages|logo|logos|brand(ing)?|brand guide|style ?guide|icon set|icons|banner|dashboard|portfolio|shop|store|e-?commerce|packaging|motion|video|animation|copy|copywriting|photography|photo shoot|seo|cms|prototype|wireframes?|design system|mockups?|onboarding flow|flow|screens?|template|newsletter|email|showcase|careers page)\b/i;
  const deliverables = dedupe([
    ...bulletsAfter(rawText, ["deliverable", "scope", "includes", "include"]),
    ...sents
      .filter((s) => DELIVERABLE_NOUNS.test(s))
      // Skip bullets (handled above), deadline lines, constraints, and headers.
      .filter((s) => !/^[-•*]/.test(s.trim()))
      .filter((s) => !/\b(must|should|cannot|compliance|accessib|keep|existing|by\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|before\s+(?:the\s+)?(?:holiday|christmas|end))/i.test(s))
      .filter((s) => !/^(project|client|deliverables?|objectives?|constraints?|deadlines?|risks?)\s*[:–-]/i.test(s.trim()))
      .map((s) => trimClause(s))
      .filter((s) => s.length > 3 && s.split(/\s+/).length <= 16),
  ]).slice(0, 10);

  const constraints = dedupe([
    ...bulletsAfter(rawText, ["constraint", "must", "requirement", "compliance"]),
    ...sents
      .filter((s) => /\b(must|must not|cannot|can't|should|has to|have to|required|need to|keep existing|no later than|compliance|accessib|wcag|gdpr|parity)\b/i.test(s))
      .map((s) => trimClause(s))
      .filter((s) => s.length > 6 && s.length < 140),
  ]).slice(0, 8);

  const MONTH = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const dateish = new RegExp(`\\b(?:by|before|due|deadline|launch|ship|deliver|go[- ]live|release)[^.!\\n]{0,60}?((?:${MONTH})\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH})|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|(?:${MONTH})|q[1-4]|end of (?:the )?(?:month|quarter|year)|christmas|holiday season|holiday|new year|easter|summer|fall|autumn|winter|spring)\\b`, "gi");
  const deadlines = dedupe([
    ...(rawText.match(dateish) ?? []).map((m) => m.trim()),
  ]).slice(0, 6);

  const risks = dedupe([
    ...bulletsAfter(rawText, ["risk", "concern", "challenge", "dependency"]),
    ...sents
      .filter((s) => /\b(risk|concern|worry|challenge|dependency|depends on|slow|delay|tight|bottleneck|weather|approval loop|limited availability)\b/i.test(s))
      .map((s) => trimClause(s))
      .filter((s) => s.length > 8 && s.length < 140),
  ]).slice(0, 6);

  let budgetTier: BudgetTier = "standard";
  if (/\b(limited|small|starter|tight|low[ -]budget|shoestring|mvp|minimal)\b/.test(lower)) budgetTier = "starter";
  if (/\b(premium|enterprise|flagship|full[ -]scale|high[ -]end|top[ -]tier)\b/.test(lower)) budgetTier = "premium";
  const amount = rawText.match(/\$\s?([\d,]+)(k|,\d{3})?/i);
  if (amount) {
    const n = parseInt(amount[1].replace(/,/g, "")) * (amount[2]?.toLowerCase() === "k" ? 1000 : 1);
    if (n < 5000) budgetTier = "starter";
    else if (n > 25000) budgetTier = "premium";
  }

  const clientMatch =
    rawText.match(/client\s*[:–-]\s*([^.!\n]{2,50})/i) ??
    rawText.match(/^([A-Z][\w&']*(?:\s+[A-Z][\w&']*){0,3})\s+(?:wants?|needs?|is|are|would like|seeks)\b/) ??
    rawText.match(/([A-Z][\w&']*(?:\s+[A-Z][\w&']*){0,3})\s*(?:'s|')\s+(?:rebrand|website|site|brand|launch|project|team)/) ??
    rawText.match(/(?:for|from)\s+([A-Z][\w&' ]{2,40})/);
  const projectMatch = rawText.match(/project\s*[:–-]\s*([^.!\n]{2,80})/i);
  const firstSentence = sentences(rawText).find((s) => !/^client\s*[:–-]/i.test(s));
  // A good default project name: the client + the headline ask, shortened.
  const projectName =
    projectMatch?.[1] ??
    (cleanClientFrom(clientMatch?.[1]) && firstSentence
      ? `${cleanClientFrom(clientMatch?.[1])} — ${shortenAsk(firstSentence)}`
      : firstSentence ?? "");
  const cleanClient = cleanClientFrom(clientMatch?.[1]);
  const missingInfo: string[] = [];
  if (!/\bhosting\b/i.test(lower)) missingInfo.push("Hosting preferences not specified");
  if (!/\baccessib|a11y|wcag\b/i.test(lower)) missingInfo.push("Accessibility requirements not specified");
  if (!/\bbudget|price|\$/i.test(lower)) missingInfo.push("Budget not specified — pricing tier assumed standard");
  if (!/\bsign[- ]?off|approval/i.test(lower)) missingInfo.push("Approval sign-off owner not identified");

  return {
    projectName: projectName.trim().slice(0, 80),
    client: cleanClient,
    objectives,
    deliverables,
    constraints,
    deadlines,
    budgetTier,
    risks,
    missingInfo,
    engine: "desgenz-heuristic",
  };
}

function cleanClientFrom(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/[,.;:]$/, "").replace(/\s+(wants?|needs?|is|are)$/i, "");
}

/** Distill a first sentence into a short project-name ask. */
function shortenAsk(sentence: string): string {
  const cleaned = sentence.replace(/^(?:they\s+|we\s+)/i, "");
  const verb = cleaned.match(/\b(?:wants? to|needs? to|would like to|looking to|seeks to)\s+(.{3,40}?)(?:\.|,| and | with |$)/i);
  if (verb) return verb[1].trim();
  const noun = cleaned.match(/\b(?:new|fresh)\s+(marketing website|website|brand|logo|app|portfolio|store)\b/i);
  if (noun) return `${noun[1]} refresh`;
  return cleaned.split(/\s+/).slice(0, 5).join(" ").replace(/[,.;]$/, "");
}

export async function scoreProject(
  req: RequirementDoc
): Promise<EngineResult<{ complexity: number; feasibility: number; budgetRealism: number; rationale: string; basis: string }>> {
  const prompt = `You are the DesGenZ Intelligence Engine. Given these confirmed requirements, return JSON with keys: complexity (0-100), feasibility (0-100 deadline feasibility), budgetRealism (0-100), rationale (2-3 sentences explaining the scores), basis (one short line like "4 deliverables, 30-day timeline"). Requirements: ${JSON.stringify({
    deliverables: req.deliverables,
    constraints: req.constraints,
    deadlines: req.deadlines,
    budgetTier: req.budgetTier,
  })}`;
  const response = await callGemini(prompt);
  if (response) {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          engine: "gemini-2.5-flash",
          data: {
            complexity: clamp(parsed.complexity ?? 50),
            feasibility: clamp(parsed.feasibility ?? 50),
            budgetRealism: clamp(parsed.budgetRealism ?? 50),
            rationale: parsed.rationale || "Model rationale unavailable.",
            basis: parsed.basis || "derived from confirmed requirements",
          },
        };
      } catch {
        // fall through
      }
    }
  }

  const n = req.deliverables.length;
  const pages = Math.max(1, req.deliverables.filter((d) => /page|site|screen|app/i.test(d)).length * 2 + 2);
  const hasDeadline = req.deadlines.some((d) => !/no explicit/i.test(d));
  const hardConstraints = req.constraints.length;

  const complexity = clamp(30 + n * 7 + hardConstraints * 4 + (req.budgetTier === "premium" ? 10 : 0));
  const feasibility = clamp((hasDeadline ? 55 : 75) + (req.budgetTier === "premium" ? 10 : req.budgetTier === "starter" ? -12 : 0) + (n > 5 ? -10 : 5) - hardConstraints * 2);
  const budgetRealism = clamp(req.budgetTier === "starter" ? 48 : req.budgetTier === "standard" ? 66 : 78) - Math.max(0, n - 4) * 3;
  const tightened = feasibility < 55;

  return {
    engine: "desgenz-heuristic",
    data: {
      complexity,
      feasibility,
      budgetRealism,
      rationale: tightened
        ? `Feasibility is tight: ${n} deliverables against ${req.deadlines[0] ?? "an unspecified deadline"} with ${hardConstraints} constraints. Consider narrowing scope or renegotiating the timeline.`
        : `Scope of ${n} deliverables fits the ${req.budgetTier} tier and ${req.deadlines[0] ?? "timeline"}. ${hardConstraints} constraint(s) tracked, no blocker expected at this stage.`,
      basis: `${n} deliverables, ${hardConstraints} constraints, ${req.budgetTier} tier, ${hasDeadline ? "hard deadline present" : "no hard deadline"}`,
    },
  };
}

export interface EngineResult<T> {
  engine: EngineName;
  data: T;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const TIER_PLAN: Record<BudgetTier, { screens: number; sections: string[] }> = {
  starter: { screens: 3, sections: ["Header", "Hero", "Content", "Footer"] },
  standard: { screens: 6, sections: ["Header", "Hero", "Features", "Social proof", "CTA", "Footer"] },
  premium: { screens: 10, sections: ["Header", "Hero", "Features", "Detail grid", "Case study", "Testimonials", "Pricing", "FAQ", "CTA", "Footer"] },
};

const PALETTES = {
  warm: ["#F6F1EA", "#E7D8C3", "#B08B5E", "#4A3B2C", "#20201D"],
  cool: ["#F2F5F8", "#DCE6F0", "#8FA8C7", "#3C5578", "#1A2330"],
  fresh: ["#F4F8F4", "#DDEEDF", "#7FB89A", "#39655A", "#1C2B26"],
};

function pickPalette(seedText: string): string[] {
  const lower = seedText.toLowerCase();
  if (/coffee|food|restaurant|bakery|warm|craft/.test(lower)) return PALETTES.warm;
  if (/finance|bank|saas|tech|platform|corporate/.test(lower)) return PALETTES.cool;
  if (/health|wellness|garden|plant|eco|fitness/.test(lower)) return PALETTES.fresh;
  return PALETTES.cool;
}

const TYPE_PAIRS = [
  { heading: "Sora", body: "Inter", note: "Geometric headings, neutral body — safe modern pick" },
  { heading: "Fraunces", body: "Inter", note: "Expressive serif headings — brand-forward" },
  { heading: "Space Grotesk", body: "IBM Plex Sans", note: "Technical, product feel" },
];

/**
 * Stage 6 draft generator: budget tier → screens/sections plan, structural
 * page composition, palette and typography. The result is a structured draft
 * the UI renders as wireframe pages. When a Figma MCP endpoint is configured,
 * this same plan is pushed to Figma; otherwise the plan IS the draft.
 */
export function generateDraftPlan(project: Project): {
  pages: { name: string; sections: { name: string; height: number; tone: "primary" | "accent" | "surface" | "muted" }[] }[];
  palette: string[];
  typography: { heading: string; body: string; note: string };
  tierPlan: { screens: number; sections: string[] };
} {
  const tierPlan = TIER_PLAN[project.budgetTier];
  const palette = pickPalette(`${project.name} ${project.client} ${project.requirements.rawText}`);
  const typography = TYPE_PAIRS[project.name.length % TYPE_PAIRS.length];

  const pages: { name: string; sections: { name: string; height: number; tone: "primary" | "accent" | "surface" | "muted" }[] }[] = [];
  const screenNames = ["Home", ...pageNamesFor(project), "Contact"].slice(0, tierPlan.screens);

  for (const name of screenNames) {
    const sections = tierPlan.sections.map((s, i) => ({
      name: s === "Content" ? `${name} content` : s,
      height: s === "Hero" ? 180 : 60 + ((i * 23) % 70),
      tone:
        s === "Hero" ? ("primary" as const)
        : s === "CTA" ? ("accent" as const)
        : i % 2 === 0 ? ("surface" as const)
        : ("muted" as const),
    }));
    pages.push({ name, sections });
  }
  return { pages, palette, typography, tierPlan };
}

function pageNamesFor(project: Project): string[] {
  const fromDeliverables = project.requirements.deliverables
    .flatMap((d) => d.match(/home|shop|store|story|about|pricing|gallery|menu|portfolio|contact|blog|team|faq/gi) ?? [])
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
  const unique = [...new Set(fromDeliverables)];
  const fillers = ["About", "Services", "Work", "Pricing", "Gallery", "Team", "FAQ", "Blog"];
  for (const f of fillers) {
    if (unique.length >= 8) break;
    if (!unique.some((u) => u.toLowerCase() === f.toLowerCase())) unique.push(f);
  }
  return unique;
}

export function tasksFromRequirements(req: RequirementDoc): Omit<Task, "id">[] {
  const templates: { title: string; priority: Task["priority"]; checklist: string[] }[] = [
    { title: "Kickoff & requirements walkthrough", priority: "high", checklist: ["Confirm missing info", "Align on timeline"] },
    { title: "Moodboard & art direction", priority: "high", checklist: ["Collect references", "Present 2 directions"] },
    { title: "Core design system (colors, type, components)", priority: "high", checklist: ["Palette", "Type scale", "Component sheet"] },
    { title: "Draft key screens", priority: "high", checklist: ["Home page", "Secondary screens"] },
    { title: "Internal review pass", priority: "medium", checklist: ["Annotations", "Fix flagged issues"] },
    { title: "Client approval package", priority: "medium", checklist: ["Export previews", "Send portal link"] },
    { title: "Final delivery & handoff", priority: "low", checklist: ["Source files", "Usage guide"] },
  ];
  return templates.map((t) => ({
    title: t.title,
    priority: t.priority,
    status: "todo" as const,
    dependsOn: [],
    checklist: t.checklist.map((text) => ({ text, done: false })),
    comments: [],
    createdAt: new Date().toISOString(),
  }));
}
