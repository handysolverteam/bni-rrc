alter table public.import_batches
drop constraint if exists import_batches_source_type_check;

alter table public.import_batches
add constraint import_batches_source_type_check
check (
  source_type in (
    'unknown',
    'membership_dues_xls',
    'traffic_lights_pdf',
    'palms_chapter_summary',
    'membership_length_pdf',
    'chapter_sponsor_report',
    'chapter_member_training_report'
  )
);

create table public.member_training_achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  chapter_name text not null default '',
  region_name text,
  event_date date not null,
  event_type text not null,
  role text,
  join_date date,
  induction_date date,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, chapter_name, event_date, event_type)
);

create index member_training_achievements_member_event_idx
on public.member_training_achievements (member_id, event_date desc);

create trigger member_training_achievements_set_updated_at
before update on public.member_training_achievements
for each row execute function public.set_updated_at();

alter table public.member_training_achievements enable row level security;

create policy "authenticated training achievements read"
on public.member_training_achievements for select
to authenticated
using (true);

create policy "committee training achievements write"
on public.member_training_achievements for all
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
