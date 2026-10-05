-- Scope AI chat history to the owning user.
--
-- The chat API authenticates via Firebase (not Supabase Auth), so the owner
-- is the Firebase uid string recorded at insert time. All chat routes filter
-- by this column. Rows written before this migration keep user_id NULL and
-- are therefore invisible to the scoped queries (no cross-user leakage).

alter table public.ai_chat_messages
  add column if not exists user_id text;

create index if not exists ai_chat_messages_user_created_idx
  on public.ai_chat_messages (user_id, created_at);
