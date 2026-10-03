-- Wayfare production schema.
--
-- Design rules
--   * Every user-owned table has RLS keyed on auth.uid(); child rows carry a
--     composite FK (parent_id, user_id) so a row can never point at another
--     user's parent, even with a forged payload.
--   * `updated_at` is stamped by the SERVER on every write. Clients pull with
--     `updated_at > cursor`, so a phone with a wrong clock cannot hide or
--     overwrite data.
--   * Deletes are soft (`deleted_at`) so other devices learn about them.
--   * Anonymous users can only call get_shared_trip(); no table is readable.

-- ---------------------------------------------------------------------------
-- 0. Move the legacy prototype tables aside (non-destructive; refuses if they
--    hold data). They are dropped by 20261004000100_wayfare_drop_legacy.sql.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trips' and column_name = 'planned_budget'
  ) then
    if exists (select 1 from public.trips limit 1)
       or exists (select 1 from public.expenses limit 1)
       or exists (select 1 from public.pack_state limit 1)
       or exists (select 1 from public.profiles limit 1) then
      raise exception 'Legacy Wayfare tables contain data; migrate it manually before applying this migration';
    end if;
    alter table public.pack_state rename to legacy_pack_state;
    alter table public.expenses rename to legacy_expenses;
    alter table public.trips rename to legacy_trips;
    alter table public.profiles rename to legacy_profiles;
    alter index public.pack_state_pkey rename to legacy_pack_state_pkey;
    alter index public.expenses_pkey rename to legacy_expenses_pkey;
    alter index public.trips_pkey rename to legacy_trips_pkey;
    alter index public.profiles_pkey rename to legacy_profiles_pkey;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Shared trigger helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  home_region text check (home_region is null or char_length(home_region) <= 80),
  tier text not null default 'traveler' check (tier in ('traveler', 'hardcore', 'legendary')),
  privacy_default text not null default 'private' check (privacy_default in ('private', 'link')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trek_id integer references public.treks (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  trip_type text not null default 'trek' check (trip_type in ('trek', 'road', 'city')),
  destination text check (destination is null or char_length(destination) <= 120),
  starts_on date,
  ends_on date,
  visibility text not null default 'private' check (visibility in ('private', 'link')),
  companions text check (companions is null or char_length(companions) <= 300),
  status text not null default 'active' check (status in ('active', 'completed')),
  notes text check (notes is null or char_length(notes) <= 5000),
  share_id text unique check (share_id is null or char_length(share_id) >= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (visibility = 'private' or share_id is not null)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null default auth.uid(),
  recorded_at timestamptz not null default now(),
  body text check (body is null or char_length(body) <= 20000),
  mood text check (mood is null or char_length(mood) <= 40),
  place_name text check (place_name is null or char_length(place_name) <= 120),
  weather text check (weather is null or char_length(weather) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null default auth.uid(),
  category text not null default 'other'
    check (category in ('food', 'stay', 'transport', 'gear', 'permit', 'other')),
  amount numeric(12, 2) not null check (amount >= 0 and amount < 1000000000),
  currency text not null default 'INR' check (char_length(currency) = 3),
  note text check (note is null or char_length(note) <= 300),
  spent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null default auth.uid(),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  packed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);

-- Append-only GPS breadcrumbs: no updated_at/deleted_at, pulled by created_at.
create table public.track_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null default auth.uid(),
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude_m double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);

create table public.entry_media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  entry_id uuid not null,
  user_id uuid not null default auth.uid(),
  kind text not null default 'photo' check (kind in ('photo', 'audio')),
  storage_path text not null check (storage_path like (user_id::text || '/%')),
  mime_type text not null default 'image/jpeg' check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
                  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/aac')
  ),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade,
  foreign key (entry_id, user_id) references public.entries (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 3. Indexes (every FK column set is a left prefix of an index)
-- ---------------------------------------------------------------------------
create index trips_user_updated_idx on public.trips (user_id, updated_at);
create index trips_trek_idx on public.trips (trek_id) where trek_id is not null;

create index entries_trip_user_idx on public.entries (trip_id, user_id, recorded_at);
create index entries_user_updated_idx on public.entries (user_id, updated_at);

create index expenses_trip_user_idx on public.expenses (trip_id, user_id);
create index expenses_user_updated_idx on public.expenses (user_id, updated_at);

create index packing_trip_user_idx on public.packing_items (trip_id, user_id);
create index packing_user_updated_idx on public.packing_items (user_id, updated_at);

create index track_points_trip_user_idx on public.track_points (trip_id, user_id, recorded_at);
create index track_points_user_created_idx on public.track_points (user_id, created_at);

create index entry_media_entry_user_idx on public.entry_media (entry_id, user_id);
create index entry_media_trip_user_idx on public.entry_media (trip_id, user_id);
create index entry_media_user_updated_idx on public.entry_media (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trips_set_updated_at before insert or update on public.trips
  for each row execute function public.set_updated_at();
create trigger entries_set_updated_at before insert or update on public.entries
  for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before insert or update on public.expenses
  for each row execute function public.set_updated_at();
create trigger packing_set_updated_at before insert or update on public.packing_items
  for each row execute function public.set_updated_at();
create trigger entry_media_set_updated_at before insert or update on public.entry_media
  for each row execute function public.set_updated_at();

-- A deleted trip can never stay shared.
create or replace function public.trip_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    new.visibility := 'private';
    new.share_id := null;
  end if;
  return new;
end;
$$;

create trigger trips_before_write before insert or update on public.trips
  for each row execute function public.trip_before_write();

-- NOTE: deleting a trip is done by the client in two steps: it hard-deletes the
-- trip's child rows through the API, then writes the trip tombstone
-- (deleted_at). Other devices drop the children when they pull the tombstone.

-- Soft-deleting an entry tombstones its media so other devices drop them.
create or replace function public.entry_soft_delete_cascade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.entry_media
     set deleted_at = new.deleted_at
   where entry_id = new.id and deleted_at is null;
  return null;
end;
$$;

create trigger entries_soft_delete_cascade after update of deleted_at on public.entries
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.entry_soft_delete_cascade();

-- Profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.trip_before_write() from public, anon, authenticated;
revoke all on function public.entry_soft_delete_cascade() from public, anon, authenticated;

-- Fresh projects: ensure the auth trigger exists (hosted project already has it
-- and keeps pointing at this function).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Row level security + least-privilege grants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.entries enable row level security;
alter table public.expenses enable row level security;
alter table public.packing_items enable row level security;
alter table public.track_points enable row level security;
alter table public.entry_media enable row level security;
alter table public.treks enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy trips_own on public.trips
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy entries_own on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_own on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy packing_own on public.packing_items
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy track_points_own on public.track_points
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy entry_media_own on public.entry_media
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- treks keeps its existing public read policy ("treks readable by all").

revoke all on all tables in schema public from anon, authenticated;
grant select on public.treks to anon, authenticated;
grant select on public.profiles to authenticated;
-- tier is server-controlled; users may only edit their own descriptive fields.
grant update (display_name, home_region, privacy_default) on public.profiles to authenticated;
grant select, insert, update, delete on
  public.trips, public.entries, public.expenses, public.packing_items,
  public.track_points, public.entry_media
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Public read-only share link (the ONLY thing anon can call)
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_trip(p_share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'title', t.title,
      'destination', t.destination,
      'trip_type', t.trip_type,
      'starts_on', t.starts_on,
      'ends_on', t.ends_on,
      'notes', t.notes
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recorded_at', e.recorded_at,
          'body', e.body,
          'mood', e.mood,
          'place_name', e.place_name,
          'weather', e.weather
        ) order by e.recorded_at asc
      )
      from (
        select * from public.entries
        where trip_id = t.id and deleted_at is null
        order by recorded_at asc
        limit 500
      ) e
    ), '[]'::jsonb)
  )
  from public.trips t
  where p_share_id is not null
    and char_length(p_share_id) >= 20
    and t.share_id = p_share_id
    and t.visibility = 'link'
    and t.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage: private bucket, owner-only, photos + voice notes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-media',
  'entry-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/aac']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy entry_media_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy entry_media_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy entry_media_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy entry_media_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'entry-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
