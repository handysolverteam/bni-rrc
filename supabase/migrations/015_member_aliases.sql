create table public.member_aliases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  alias_name text not null,
  normalized_alias_name text not null,
  source text not null default 'manual'
    check (source in ('manual', 'rename', 'import_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, normalized_alias_name)
);

create index member_aliases_normalized_alias_name_idx
on public.member_aliases (normalized_alias_name);

create trigger member_aliases_set_updated_at
before update on public.member_aliases
for each row execute function public.set_updated_at();

alter table public.member_aliases enable row level security;

create policy "authenticated member aliases read"
on public.member_aliases for select
to authenticated
using (true);

create policy "authenticated member aliases write"
on public.member_aliases for all
to authenticated
using (true)
with check (true);

do $$
declare
  legacy_member_id uuid;
  canonical_member_id uuid;
begin
  select id
  into canonical_member_id
  from public.members
  where lower(name) = 'kunnal gupta'
  order by updated_at desc
  limit 1;

  select id
  into legacy_member_id
  from public.members
  where lower(name) = 'kunal gupta'
    and lower(coalesce(industry, '')) = lower('Shutters & Awnings')
  order by updated_at desc
  limit 1;

  if legacy_member_id is not null and canonical_member_id is null then
    update public.members
    set name = 'Kunnal Gupta'
    where id = legacy_member_id;

    canonical_member_id := legacy_member_id;
  end if;

  if canonical_member_id is not null then
    insert into public.member_aliases (
      member_id,
      alias_name,
      normalized_alias_name,
      source
    )
    values (
      canonical_member_id,
      'Kunal Gupta',
      'kunal gupta',
      'rename'
    )
    on conflict (member_id, normalized_alias_name) do update
    set alias_name = excluded.alias_name,
        source = excluded.source;
  end if;
end $$;
