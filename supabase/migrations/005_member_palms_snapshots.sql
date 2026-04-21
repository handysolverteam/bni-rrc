create table public.member_palms_snapshots (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  chapter_name text not null,
  report_from date not null,
  report_to date not null,
  run_at timestamptz,
  present_count integer not null default 0,
  absent_count integer not null default 0,
  late_count integer not null default 0,
  medical_count integer not null default 0,
  substitute_count integer not null default 0,
  referrals_given_inside integer not null default 0,
  referrals_given_outside integer not null default 0,
  referrals_received_inside integer not null default 0,
  referrals_received_outside integer not null default 0,
  visitors integer not null default 0,
  one_to_ones numeric not null default 0,
  tyfcb numeric,
  ceu integer not null default 0,
  trainings integer not null default 0,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, chapter_name, report_from, report_to)
);

create index member_palms_snapshots_member_report_to_idx
on public.member_palms_snapshots (member_id, report_to desc);

create trigger member_palms_snapshots_set_updated_at
before update on public.member_palms_snapshots
for each row execute function public.set_updated_at();

alter table public.member_palms_snapshots enable row level security;

create policy "authenticated palms snapshots read"
on public.member_palms_snapshots for select
to authenticated
using (true);

create policy "committee palms snapshots write"
on public.member_palms_snapshots for all
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
