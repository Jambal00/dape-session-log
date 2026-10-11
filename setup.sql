-- DAPE Session Log: database setup.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- One table holds everything the app saves (schools, students, sessions and so on),
-- one row per item. Row-level security means each signed-in person can only
-- read and change their own rows.

create table if not exists public.dape_docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  coll       text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);

alter table public.dape_docs enable row level security;

drop policy if exists "dape_docs_select_own" on public.dape_docs;
drop policy if exists "dape_docs_insert_own" on public.dape_docs;
drop policy if exists "dape_docs_update_own" on public.dape_docs;
drop policy if exists "dape_docs_delete_own" on public.dape_docs;

create policy "dape_docs_select_own" on public.dape_docs for select to authenticated using (user_id = auth.uid());
create policy "dape_docs_insert_own" on public.dape_docs for insert to authenticated with check (user_id = auth.uid());
create policy "dape_docs_update_own" on public.dape_docs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dape_docs_delete_own" on public.dape_docs for delete to authenticated using (user_id = auth.uid());

revoke all on public.dape_docs from anon;
grant select, insert, update, delete on public.dape_docs to authenticated;
