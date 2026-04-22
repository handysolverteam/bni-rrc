create table public.member_sponsor_achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sponsored_first_name text not null,
  sponsored_last_name text not null default '',
  sponsored_full_name text not null,
  sponsored_region text,
  sponsored_chapter text not null default '',
  application_date date not null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, sponsored_full_name, application_date, sponsored_chapter)
);

create index member_sponsor_achievements_member_application_idx
on public.member_sponsor_achievements (member_id, application_date desc);

create trigger member_sponsor_achievements_set_updated_at
before update on public.member_sponsor_achievements
for each row execute function public.set_updated_at();

alter table public.member_sponsor_achievements enable row level security;

create policy "authenticated sponsor achievements read"
on public.member_sponsor_achievements for select
to authenticated
using (true);

create policy "committee sponsor achievements write"
on public.member_sponsor_achievements for all
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
