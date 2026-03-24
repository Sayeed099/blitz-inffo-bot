-- Supabase SQL Editor da ishga tushiring (bir marta).
-- Keyin bot .env da SUPABASE_URL va SUPABASE_ANON_KEY bo'lishi kerak.

create table if not exists public.bot_users (
  telegram_user_id bigint primary key,
  first_name text,
  phone text,
  username text,
  registered_at timestamptz not null default now()
);

alter table public.bot_users enable row level security;

create policy "anon_select_bot_users"
  on public.bot_users for select
  to anon
  using (true);

create policy "anon_insert_bot_users"
  on public.bot_users for insert
  to anon
  with check (true);

create policy "anon_update_bot_users"
  on public.bot_users for update
  to anon
  using (true)
  with check (true);

-- api/bot.js (Vercel/Telegraf) uchun; grammY bilan bir jadval kerak bo'lsa .env da SUPABASE_USERS_TABLE=bot_users
create table if not exists public.users (
  telegram_user_id bigint primary key,
  first_name text,
  phone text,
  username text,
  registered_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "anon_select_users"
  on public.users for select
  to anon
  using (true);

create policy "anon_insert_users"
  on public.users for insert
  to anon
  with check (true);

create policy "anon_update_users"
  on public.users for update
  to anon
  using (true)
  with check (true);
