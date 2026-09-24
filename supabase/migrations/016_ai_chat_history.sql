create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null check (sender in ('user', 'ai')),
  text text not null,
  options jsonb not null default '[]'::jsonb,
  session_id text not null default 'default',
  created_at timestamptz not null default now()
);

create index ai_chat_messages_session_created_idx
on public.ai_chat_messages (session_id, created_at);

alter table public.ai_chat_messages enable row level security;

create policy "authenticated ai chat read"
on public.ai_chat_messages for select
to authenticated
using (true);

create policy "authenticated ai chat write"
on public.ai_chat_messages for insert
to authenticated
with check (true);

create policy "authenticated ai chat delete"
on public.ai_chat_messages for delete
to authenticated
using (true);