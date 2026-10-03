-- Wayfare stage 2: entry media + storage bucket + sync timestamps

alter table public.expenses
  add column if not exists updated_at timestamptz not null default now();

alter table public.packing_items
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.entry_media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  mime_type text not null default 'image/jpeg',
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entry_media_entry_id_idx on public.entry_media (entry_id);
create index if not exists entry_media_trip_id_idx on public.entry_media (trip_id);

alter table public.entry_media enable row level security;

create policy entry_media_all_own on public.entry_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-media',
  'entry-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy entry_media_storage_select_own on storage.objects
  for select using (
    bucket_id = 'entry-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy entry_media_storage_insert_own on storage.objects
  for insert with check (
    bucket_id = 'entry-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy entry_media_storage_update_own on storage.objects
  for update using (
    bucket_id = 'entry-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy entry_media_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'entry-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
