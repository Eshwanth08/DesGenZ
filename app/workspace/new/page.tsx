import { requireRole } from "@/lib/session";
import IntakeWizard from "./IntakeWizard";

export const metadata = { title: "DesGenZ — New project" };

export default async function NewProjectPage() {
  await requireRole("employee");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">New project</h1>
      <p className="text-text-secondary text-sm mt-1">
        Stage 1 — paste the client requirement document; the Requirement Analyzer extracts structure you confirm before anything downstream runs.
      </p>
      <div className="mt-6">
        <IntakeWizard />
      </div>
    </div>
   );
}
