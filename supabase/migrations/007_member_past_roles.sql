create table public.chapter_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create table public.member_past_roles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  role_id uuid not null references public.chapter_roles(id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, role_id)
);

create index member_past_roles_member_display_order_idx
on public.member_past_roles (member_id, display_order asc, created_at asc);

create trigger chapter_roles_set_updated_at
before update on public.chapter_roles
for each row execute function public.set_updated_at();

create trigger member_past_roles_set_updated_at
before update on public.member_past_roles
for each row execute function public.set_updated_at();

alter table public.chapter_roles enable row level security;
alter table public.member_past_roles enable row level security;

create policy "authenticated chapter roles read"
on public.chapter_roles for select
to authenticated
using (true);

create policy "authenticated chapter roles write"
on public.chapter_roles for all
to authenticated
using (true)
with check (true);

create policy "authenticated member past roles read"
on public.member_past_roles for select
to authenticated
using (true);

create policy "authenticated member past roles write"
on public.member_past_roles for all
to authenticated
using (true)
with check (true);
