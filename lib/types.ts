export type Role = "hr" | "employee";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Set only for accounts created while the app runs on the local JSON store
   *  (scrypt hash). Cloud accounts keep their hash in Supabase auth.users. */
  passwordHash?: string;
}

export interface Session {
  user: User;
}

export type BudgetTier = "starter" | "standard" | "premium";

/** Metadata for files the employee attached at intake (content lives in rawText). */
export interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
}

/** AI-drafted simplified report: plain-language digest of the requirement doc. */
export interface AnalysisReport {
  summary: string;
  sections: { heading: string; points: string[] }[];
  openQuestions: string[];
  engine: string;
  generatedAt: string;
}

/** In-app employee ↔ HR direct message. */
export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  fromRole: Role;
  toId: string;
  toName: string;
  text: string;
  projectId?: string;
  at: string;
  read: boolean;
}

export interface RequirementDoc {
  projectName: string;
  client: string;
  objectives: string[];
  deliverables: string[];
  constraints: string[];
  deadlines: string[];
  budgetTier: BudgetTier;
  risks: string[];
  missingInfo: string[];
  rawText: string;
  confirmed: boolean;
  attachments?: AttachmentMeta[];
  report?: AnalysisReport;
}

export type ProjectStage =
  | "intake"
  | "intelligence"
  | "tasks"
  | "schedule"
  | "draft"
  | "review"
  | "approval"
  | "versions"
  | "portal";

export interface Intelligence {
  complexity: number;
  feasibility: number;
  budgetRealism: number;
  rationale: string;
  basis: string;
}

export interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "doing" | "done";
  dependsOn: string[];
  checklist: { text: string; done: boolean }[];
  comments: { author: string; text: string; at: string }[];
  attachment?: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  name: string;
  startDay: number;
  endDay: number;
  taskIds: string[];
}

export type DraftStatus = "generating" | "ready" | "in_review" | "approved" | "changes_requested";

export interface Annotation {
  id: string;
  draftId: string;
  page: number;
  x: number;
  y: number;
  text: string;
  author: string;
  at: string;
  resolved: boolean;
}

export interface Draft {
  id: string;
  projectId: string;
  version: number;
  status: DraftStatus;
  pages: DraftPage[];
  palette: string[];
  typography: { heading: string; body: string; note: string };
  notes: string;
  createdAt: string;
  figmaRef?: string;
}

export interface DraftPage {
  name: string;
  sections: { name: string; height: number; tone: "primary" | "accent" | "surface" | "muted" }[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  budgetTier: BudgetTier;
  stage: ProjectStage;
  createdAt: string;
  updatedAt: string;
  requirements: RequirementDoc;
  intelligence?: Intelligence;
  tasks: Task[];
  milestones: Milestone[];
  drafts: Draft[];
  annotations: Annotation[];
  approvals: { at: string; by: string; decision: "approved" | "changes_requested"; note: string }[];
  versions: { id: string; label: string; note: string; at: string; draftId?: string }[];
  portalToken: string;
  assignedTo: string;
}

export interface Analytics {
  totalProjects: number;
  activeProjects: number;
  approvedProjects: number;
  avgComplexity: number;
  avgFeasibility: number;
  reworkCount: number;
  delayedCount: number;
  completionRate: number;
}

export interface DB {
  users: User[];
  projects: Project[];
  messages?: Message[];
}
