-- Tempo cross-device sync: storage for synced progress, addressed by sync code.
-- Applied to the Supabase project in src/sync/config.ts (migration "sync_slots").
-- To use another project, run this once (SQL editor, or `supabase db push`).
--
-- Design:
--  * No accounts. Each synced copy is stored under sha256(sync code); the code itself is
--    never stored. A code is 100 random bits, so copies cannot be guessed or listed.
--  * The table is not reachable through the public API at all (RLS on, no policies, no
--    grants). The app can only call the three SECURITY DEFINER functions below.
--  * sync_put is a compare-and-swap on `version`, so two devices cannot overwrite each
--    other: the loser pulls, merges and retries.
--  * sync_delete removes a copy for good. The app creates a copy (base_version 0) only on a
--    device's first sync with a new code, and joining with a code needs an existing copy, so a
--    device that synced with a deleted copy stops syncing instead of re-creating it.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sync_slots (
  id text primary key,                         -- hex sha256 of the sync code
  data jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_slots enable row level security;
revoke all on table public.sync_slots from anon, authenticated, public;

create or replace function public.sync_slot_id(code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(upper(code), 'sha256'), 'hex')
$$;

create or replace function public.sync_get(code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('data', s.data, 'version', s.version)
  from public.sync_slots s
  where length(code) = 20 and s.id = public.sync_slot_id(code)
$$;

create or replace function public.sync_put(code text, data jsonb, base_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot text;
  v bigint;
begin
  if code is null or code !~ '^[0-9A-HJKMNP-TV-Z]{20}$' then
    raise exception 'invalid sync code';
  end if;
  if pg_column_size(data) > 3000000 then
    raise exception 'synced data too large';
  end if;
  slot := public.sync_slot_id(code);
  if base_version = 0 then
    insert into public.sync_slots (id, data) values (slot, sync_put.data)
    on conflict (id) do nothing
    returning version into v;
  else
    update public.sync_slots
       set data = sync_put.data, version = version + 1, updated_at = now()
     where id = slot and version = base_version
    returning version into v;
  end if;
  if v is null then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'version', v);
end
$$;

create or replace function public.sync_delete(code text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.sync_slots where length(code) = 20 and id = public.sync_slot_id(code)
$$;

revoke all on function public.sync_slot_id(text) from public, anon, authenticated;
revoke all on function public.sync_get(text) from public;
revoke all on function public.sync_put(text, jsonb, bigint) from public;
revoke all on function public.sync_delete(text) from public;
grant execute on function public.sync_get(text) to anon, authenticated;
grant execute on function public.sync_put(text, jsonb, bigint) to anon, authenticated;
grant execute on function public.sync_delete(text) to anon, authenticated;
