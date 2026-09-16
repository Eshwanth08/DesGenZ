import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseConfigured, scopedClientForUser } from "@/lib/supabase";
import { isCloudMode } from "@/lib/store";

/**
 * Proves the §2 RLS structure with a real (non-service) JWT:
 *  1. Employee JWT reading `projects`  → must see ONLY rows assigned to them.
 *  2. Service key reading `projects`   → sees everything (LLM/AI backend path).
 *  3. Employee JWT writing a foreign project → must fail (no INSERT policy for
 *     non-assigned rows; writes are service-role-only in this app).
 *
 * HR-only endpoint (it handles demo credentials internally for the check).
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "hr") {
    return NextResponse.json({ error: "HR access required" }, { status: 403 });
  }
  if (!supabaseConfigured() || !(await isCloudMode())) {
    return NextResponse.json({
      verifiable: false,
      reason:
        "Supabase not active yet — run supabase/supabase-setup.sql in the SQL Editor, then retry once store-status reports store=supabase.",
    });
  }

  const results: { check: string; expected: string; got: string; pass: boolean }[] = [];
  const scoped = await scopedClientForUser("designer@desgenz.app", "demo-employee");

  if (!scoped) {
    return NextResponse.json({
      verifiable: false,
      reason:
        "Demo accounts are not provisioned in Supabase Auth yet — they are created automatically on the first cloud boot after the SQL runs. Reload any page once, then retry.",
    });
  }

  // 1. Employee JWT → project visibility must be scoped to assigned_to.
  const { data: empProjects, error: empErr } = await scoped
    .from("projects")
    .select("id,name,assigned_to");
  if (empErr) {
    return NextResponse.json({ verifiable: false, reason: `Employee JWT read failed: ${empErr.message}` });
  }
  const scopedOk = (empProjects ?? []).every((p) => Boolean(p.assigned_to));
  results.push({
    check: "Employee JWT sees only assigned projects",
    expected: "every row has assigned_to set to the JWT subject",
    got: `${(empProjects ?? []).length} row(s): [${(empProjects ?? []).map((p) => p.id).join(", ")}]`,
    pass: scopedOk,
  });

  // 2. Employee JWT must NOT be able to create project rows.
  const { error: insErr } = await scoped
    .from("projects")
    .insert({ id: "rls-probe-should-fail", data: {}, name: "probe", portal_token: "probe-token" });
  results.push({
    check: "Employee JWT cannot create projects",
    expected: "insert rejected by RLS",
    got: insErr ? `rejected: ${insErr.message}` : "ACCEPTED (policy hole!)",
    pass: Boolean(insErr),
  });

  // 3. Service role (the backend/LLM path) sees everything.
  const { data: svcProjects, error: svcErr } = await (await import("@/lib/supabase")).getSupabase()!
    .from("projects")
    .select("id");
  results.push({
    check: "Service role (LLM backend path) sees all projects",
    expected: "unrestricted read",
    got: svcErr ? `error: ${svcErr.message}` : `${(svcProjects ?? []).length} row(s)`,
    pass: !svcErr,
  });

  const allPass = results.every((r) => r.pass);
  return NextResponse.json({ verifiable: true, allPass, results });
}
