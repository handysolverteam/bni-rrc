create extension if not exists pgcrypto;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  industry text,
  sponsor text,
  report_role text,
  is_committee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index members_name_industry_unique
on public.members (lower(name), lower(coalesce(industry, '')));

create table public.renewal_cycles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  renewal_year integer not null,
  renewal_date date not null,
  status text not null default 'active'
    check (status in ('active', 'renewed', 'dropped')),
  source_membership_status text,
  auto_renewal_enabled boolean not null default false,
  last_followup_date date,
  next_followup_date date,
  online_form_filled boolean not null default false,
  online_form_filled_date date,
  checklist_filled boolean not null default false,
  checklist_filled_date date,
  payment_link_generated boolean not null default false,
  payment_link_generated_date date,
  payment_made boolean not null default false,
  payment_made_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, renewal_year)
);

create table public.renewal_assignments (
  id uuid primary key default gen_random_uuid(),
  renewal_cycle_id uuid not null references public.renewal_cycles(id) on delete cascade,
  assignee_member_id uuid not null references public.members(id) on delete restrict,
  slot smallint not null check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  unique (renewal_cycle_id, slot),
  unique (renewal_cycle_id, assignee_member_id)
);

create table public.renewal_tasks (
  id uuid primary key default gen_random_uuid(),
  renewal_cycle_id uuid not null references public.renewal_cycles(id) on delete cascade,
  task_type text not null check (
    task_type in (
      'mc_discussion',
      'member_discussion',
      'monthly_review',
      'renewal_push',
      'docs_collection',
      'critical_deadline'
    )
  ),
  due_date date not null,
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index renewal_tasks_one_open_per_type
on public.renewal_tasks (renewal_cycle_id, task_type)
where status = 'open';

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  report_date date,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger renewal_cycles_set_updated_at
before update on public.renewal_cycles
for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.renewal_cycles enable row level security;
alter table public.renewal_assignments enable row level security;
alter table public.renewal_tasks enable row level security;
alter table public.import_batches enable row level security;

create policy "authenticated members read"
on public.members for select
to authenticated
using (true);

create policy "committee members write"
on public.members for all
to authenticated
using (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
)
with check (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
);

create policy "authenticated renewal read"
on public.renewal_cycles for select
to authenticated
using (true);

create policy "committee renewal write"
on public.renewal_cycles for all
to authenticated
using (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
)
with check (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
);

create policy "authenticated assignment read"
on public.renewal_assignments for select
to authenticated
using (true);

create policy "committee assignment write"
on public.renewal_assignments for all
to authenticated
using (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
)
with check (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
);

create policy "authenticated task read"
on public.renewal_tasks for select
to authenticated
using (true);

create policy "committee task write"
on public.renewal_tasks for all
to authenticated
using (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
)
with check (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
);

create policy "authenticated import read"
on public.import_batches for select
to authenticated
using (true);

create policy "committee import write"
on public.import_batches for all
to authenticated
using (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
)
with check (
  exists (
    select 1 from public.members current_member
    where current_member.auth_user_id = auth.uid()
      and current_member.is_committee = true
  )
);
