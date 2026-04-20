create table public.member_traffic_lights (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  report_month date not null,
  score integer not null check (score >= 0 and score <= 100),
  color text not null check (color in ('green', 'yellow', 'red', 'grey')),
  present_count integer not null default 0,
  absent_count integer not null default 0,
  late_count integer not null default 0,
  medical_count integer not null default 0,
  substitute_count integer not null default 0,
  referrals_given integer not null default 0,
  referrals_received integer not null default 0,
  visitors integer not null default 0,
  testimonials integer not null default 0,
  tyfcb numeric,
  trainings integer not null default 0,
  week_count integer not null default 0,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, report_month)
);

create index member_traffic_lights_member_month_idx
on public.member_traffic_lights (member_id, report_month desc);

create trigger member_traffic_lights_set_updated_at
before update on public.member_traffic_lights
for each row execute function public.set_updated_at();

alter table public.member_traffic_lights enable row level security;

create policy "authenticated traffic lights read"
on public.member_traffic_lights for select
to authenticated
using (true);

create policy "committee traffic lights write"
on public.member_traffic_lights for all
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
