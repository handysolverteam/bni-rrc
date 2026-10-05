-- Performance indexes for the renewal workflow read paths.
-- These only speed up reads (seq scans -> index scans); no behavior change.

-- Dashboard/tasks fetch cycles filtered + ordered by renewal_date.
create index if not exists renewal_cycles_renewal_date_idx
on public.renewal_cycles (renewal_date);

-- Member detail + achievements fetch cycles per member ordered by renewal_date desc.
create index if not exists renewal_cycles_member_renewal_date_idx
on public.renewal_cycles (member_id, renewal_date desc);

-- Every page embeds this member's tasks (open + completed); the existing partial
-- unique index only covers open rows, so completed tasks force a seq scan.
create index if not exists renewal_tasks_renewal_cycle_status_idx
on public.renewal_tasks (renewal_cycle_id, status);

-- Member aliases are looked up by member_id; only normalized_alias_name was indexed.
create index if not exists member_aliases_member_id_idx
on public.member_aliases (member_id);

-- RLS committee checks and any auth_user_id lookup scan members.
create index if not exists members_auth_user_id_idx
on public.members (auth_user_id);