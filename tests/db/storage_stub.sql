-- TOWER — minimalna atrapa schematu `storage` Supabase (BK4) do testu na
-- czystym Postgresie. Tylko tabele i kolumny, których dotyczą polityki 0009.
-- NIGDY nie uruchamiaj na prawdziwym Supabase — nadpisałby schemat storage.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text not null,
  owner uuid default auth.uid(), created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
