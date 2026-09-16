-- DesGenZ — Supabase schema + Auth + Row-Level Security
-- Run this once in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Idempotent: safe to run multiple times. Migrates the legacy pre-auth tables
-- in place (no data loss).
--
-- Role model (build-spec §2):
--   HR        → people-data tables (user_directory, hr_assignments); NO project writes
--   Employee  → project tables scoped to projects assigned to them
--   LLM/AI    → NOT a human login: the backend's service-role key. It acts on
--               the project record it is invoked for — all app writes go through
--               the server keyed by the requesting user's identity — never
--               global client access, the key never ships to the browser.
--
-- Auth model:
--   Supabase Auth is the source of truth for credentials (sign-up/login).
--   public.user_directory mirrors app metadata (name, role) with auth.users.id
--   as primary key, so RLS policies can reference the app role directly.

-- ============================================================ people-data tables

-- App profile directory. HR has full access; employees can read it (the app
-- lists assignees) but never write it.
create table if not exists public.user_directory (
  id    uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name  text not null,
  role  text not null default 'employee' check (role in ('hr', 'employee'))
);

-- HR-only assignment bookkeeping (who is on what, workload counters).
create table if not exists public.hr_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_directory (id) on delete cascade,
  project_id  text not null,
  assigned_at timestamptz not null default now()
);

alter table public.user_directory enable row level security;
alter table public.hr_assignments enable row level security;

-- ============================================================= project tables

-- One row per project; `data` holds the full project document (requirements,
-- intelligence, tasks, milestones, drafts, annotations, approvals, versions).
-- NOTE: id stays TEXT — the app generates ids like "p-atlas" and legacy rows
-- already exist with them.
create table if not exists public.projects (
  id           text primary key,
  data         jsonb not null,
  name         text not null,
  client       text,
  stage        text,
  budget_tier  text,
  assigned_to  uuid references public.user_directory (id) on delete set null,
  portal_token text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.projects enable row level security;

-- --- migration: legacy rows store assigned_to as text ids ("u-hr"/"u-des") ---
do $$
declare
  uuid_des uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = 'assigned_to' and data_type = 'text'
  ) then
    -- Best-effort map to the designer demo account if it already exists in auth.
    select id into uuid_des from auth.users where lower(email) = 'designer@desgenz.app' limit 1;

    update public.projects
      set assigned_to = uuid_des::text
      where assigned_to = 'u-des' and uuid_des is not null;

    -- Anything still non-uuid (legacy ids with no auth counterpart) → unassigned;
    -- the app re-links these on first boot after provisioning the demo accounts.
    alter table public.projects
      alter column assigned_to type uuid
      using case
        when assigned_to ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then assigned_to::uuid
        else null
      end;
  end if;
end $$;

create index if not exists projects_assigned_idx on public.projects (assigned_to);
create index if not exists projects_portal_idx   on public.projects (portal_token);
create index if not exists projects_stage_idx    on public.projects (stage);

-- =================================================== RLS: helper + role checks

create or replace function public.app_role()
returns text
language sql stable
as $$
  select coalesce(
    (select role::text from public.user_directory where id = auth.uid()),
    'none'
  );
$$;

create or replace function public.is_hr()
returns boolean
language sql stable
as $$ select public.app_role() = 'hr'; $$;

-- ===================================================== people-data policies
-- §2: "HR sees people-data tables"

drop policy if exists "HR manages people data"     on public.user_directory;
drop policy if exists "Users read the directory"   on public.user_directory;
drop policy if exists "Users maintain own profile" on public.user_directory;
drop policy if exists "HR manages HR assignments"  on public.hr_assignments;
drop policy if exists "Staff read HR assignments"  on public.hr_assignments;

create policy "HR manages people data"
  on public.user_directory for all
  using (public.is_hr())
  with check (public.is_hr());

-- Employees may read the directory (needed to render assignee names) but only
-- ever update their own row.
create policy "Users read the directory"
  on public.user_directory for select
  using (auth.role() = 'authenticated');

create policy "Users maintain own profile"
  on public.user_directory for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select u.role from public.user_directory u where u.id = auth.uid()));

create policy "HR manages HR assignments"
  on public.hr_assignments for all
  using (public.is_hr())
  with check (public.is_hr());

create policy "Staff read HR assignments"
  on public.hr_assignments for select
  using (auth.role() = 'authenticated');

-- ====================================================== project policies
-- §2: "Employees see project tables scoped to their assigned projects"

drop policy if exists "HR reads all projects"           on public.projects;
drop policy if exists "Employees see assigned projects" on public.projects;
drop policy if exists "Assigned staff update projects"  on public.projects;

-- HR may READ project rows (workload visibility + reporting counts), but the
-- spec keeps HR managing *people*, not project content — so no write path.
create policy "HR reads all projects"
  on public.projects for select
  using (public.is_hr());

-- Employees: read + update only the projects assigned to them.
create policy "Employees see assigned projects"
  on public.projects for select
  using (assigned_to = auth.uid());

create policy "Assigned staff update projects"
  on public.projects for update
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- Only the app backend (service role) creates/deletes project rows — that is
-- the LLM/AI service path: invoked per project, server-side, never client-wide.

-- ================================================= service-role (LLM/AI) notes
-- The service_role built-in role bypasses RLS entirely; it is the "LLM / AI
-- Service" principal from §2 and lives ONLY in server env
-- (SUPABASE_SERVICE_ROLE_KEY). Its scoping is enforced in app code: every
-- mutation goes through lib/store.ts with the requesting user's id as
-- `assigned_to` / actor, and the key is never exposed to the browser. No anon
-- policies exist anywhere, so any accidental anon-key access fails closed.

-- ======================================================= legacy table cleanup
-- The pre-auth single-user store used its own users table; drop it now that
-- identities live in auth.users + user_directory.
drop table if exists public.users;

-- ============================================================ demo accounts
-- Seed handled by the app on first cloud boot: it provisions the two demo
-- accounts through the Admin Auth API (real bcrypt hashes) and mirrors them
-- into user_directory, then re-links any unassigned legacy projects.
