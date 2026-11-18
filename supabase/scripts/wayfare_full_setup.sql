-- Wayfare full setup: all 8 migrations in order. Run once in Supabase SQL Editor on an EMPTY public schema.

-- ===== migrations/20261003000000_wayfare_mvp.sql =====
-- Wayfare MVP schema (journal + utility). Social tables deferred.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  home_region text,
  tier text not null default 'traveler' check (tier in ('traveler', 'hardcore', 'legendary')),
  privacy_default text not null default 'private' check (privacy_default in ('private', 'link', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  trip_type text not null default 'trek',
  destination text,
  starts_on date,
  ends_on date,
  visibility text not null default 'private',
  companions text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  body text,
  mood text,
  place_name text,
  weather text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'other',
  amount numeric(12, 2) not null,
  currency text not null default 'INR',
  note text,
  spent_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  packed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.track_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  altitude_m double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists entries_trip_id_idx on public.entries (trip_id);
create index if not exists track_points_trip_id_idx on public.track_points (trip_id);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.entries enable row level security;
alter table public.expenses enable row level security;
alter table public.packing_items enable row level security;
alter table public.track_points enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

create policy trips_all_own on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy entries_all_own on public.entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy expenses_all_own on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy packing_all_own on public.packing_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy track_all_own on public.track_points for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== migrations/20261003120000_wayfare_media_storage.sql =====
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

-- ===== migrations/20261003180000_wayfare_share_links.sql =====
-- Read-only trip sharing via unguessable share_id (RPC for anon)

alter table public.trips
  add column if not exists share_id text unique;

create index if not exists trips_share_id_idx on public.trips (share_id) where share_id is not null;

create or replace function public.get_shared_trip(p_share_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_share_id is null or length(p_share_id) < 8 then
    return null;
  end if;
  select json_build_object(
    'trip', row_to_json(t),
    'entries', coalesce(
      (select json_agg(row_to_json(e) order by e.recorded_at asc)
       from public.entries e
       where e.trip_id = t.id),
      '[]'::json
    )
  )
  into result
  from public.trips t
  where t.share_id = p_share_id
    and t.visibility = 'link'
  limit 1;
  return result;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ===== migrations/20261006000000_wayfare_sync_v2.sql =====
-- Wayfare v2 sync: richer journal fields, itinerary, split expenses, voice-note uploads,
-- server-side route helpers and in-app account deletion.

-- ---------------------------------------------------------------------------
-- 1. Voice notes: the entry-media bucket only allowed images, so audio uploads failed.
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/3gpp'
]
where id = 'entry-media';

-- ---------------------------------------------------------------------------
-- 2. Trips: canonical place key (for matching travellers), meet-up opt-in, trip currency.
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists place_key text,
  add column if not exists open_to_meet boolean not null default false,
  add column if not exists currency text not null default 'INR',
  add column if not exists budget_total numeric(12, 2),
  add column if not exists dest_lat double precision,
  add column if not exists dest_lng double precision;

create index if not exists trips_open_place_idx on public.trips (place_key, starts_on) where open_to_meet;

-- ---------------------------------------------------------------------------
-- 3. Entries: optional geotag captured when the moment was written.
-- ---------------------------------------------------------------------------
alter table public.entries
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists altitude_m double precision;

-- ---------------------------------------------------------------------------
-- 4. Expenses: who paid and who shares the cost (names of trip companions).
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column if not exists paid_by text,
  add column if not exists split_with jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 5. Itinerary: day-by-day plan items.
-- ---------------------------------------------------------------------------
create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_index int not null default 0 check (day_index between 0 and 365),
  title text not null check (char_length(title) <= 200),
  notes text,
  start_time text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  place_name text,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists itinerary_items_trip_idx on public.itinerary_items (trip_id, day_index, sort_order);

alter table public.itinerary_items enable row level security;

drop policy if exists itinerary_all_own on public.itinerary_items;
create policy itinerary_all_own on public.itinerary_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists track_points_trip_time_idx on public.track_points (trip_id, recorded_at);
create index if not exists expenses_trip_idx on public.expenses (trip_id);
create index if not exists packing_items_trip_idx on public.packing_items (trip_id);

-- ---------------------------------------------------------------------------
-- 6. Route helpers (server-verified distance + downsampled preview line).
--    Jittery fixes (accuracy > 75 m) are dropped, as is any single fix that is more than
--    200 km/h away from both neighbours (a GPS spike, not travel). Remaining segments
--    faster than 200 km/h (flights, gaps) do not count. Internal: not client-callable.
-- ---------------------------------------------------------------------------
create or replace function public._haversine_m(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

create or replace function public._clean_track(p_trip uuid)
returns table (
  recorded_at timestamptz,
  latitude double precision,
  longitude double precision,
  altitude_m double precision
)
language sql
stable
set search_path = public
as $$
  with pts as (
    select
      tp.recorded_at as at,
      tp.latitude as lat,
      tp.longitude as lng,
      tp.altitude_m as alt,
      lag(tp.latitude) over w as plat,
      lag(tp.longitude) over w as plng,
      lag(tp.recorded_at) over w as pat,
      lead(tp.latitude) over w as nlat,
      lead(tp.longitude) over w as nlng,
      lead(tp.recorded_at) over w as nat
    from public.track_points tp
    where tp.trip_id = p_trip and coalesce(tp.accuracy_m, 0) <= 75
    window w as (order by tp.recorded_at)
  )
  select at, lat, lng, alt
  from pts
  where not (
    pat is not null and nat is not null
    and public._haversine_m(plat, plng, lat, lng) / greatest(extract(epoch from at - pat), 1) * 3.6 > 200
    and public._haversine_m(lat, lng, nlat, nlng) / greatest(extract(epoch from nat - at), 1) * 3.6 > 200
  )
$$;

create or replace function public.trip_route_km(p_trip uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(round((sum(seg_m) / 1000.0)::numeric, 2), 0)
  from (
    select
      public._haversine_m(lag(c.latitude) over w, lag(c.longitude) over w, c.latitude, c.longitude) as seg_m,
      extract(epoch from c.recorded_at - lag(c.recorded_at) over w) as dt_s
    from public._clean_track(p_trip) c
    window w as (order by c.recorded_at)
  ) segs
  where seg_m is not null and dt_s > 0 and seg_m / dt_s * 3.6 <= 200
$$;

create or replace function public.trip_route_preview(p_trip uuid, p_max int default 80)
returns jsonb
language sql
stable
set search_path = public
as $$
  with pts as (
    select
      c.latitude,
      c.longitude,
      row_number() over (order by c.recorded_at) as rn,
      count(*) over () as n
    from public._clean_track(p_trip) c
  )
  select coalesce(
    jsonb_agg(jsonb_build_array(round(longitude::numeric, 4), round(latitude::numeric, 4)) order by rn),
    '[]'::jsonb
  )
  from pts
  where n <= p_max or (rn - 1) % ceil(n::numeric / p_max)::int = 0 or rn = n
$$;

revoke all on function public._haversine_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public._clean_track(uuid) from public, anon, authenticated;
revoke all on function public.trip_route_km(uuid) from public, anon, authenticated;
revoke all on function public.trip_route_preview(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Account deletion (App Store guideline 5.1.1(v)). Cascades through profiles to
--    every user-owned row. Storage objects are removed by the client first.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ===== migrations/20261006010000_wayfare_social.sql =====
-- Wayfare social layer: public traveller profiles, follows, posts (moments + trip stories),
-- likes, comments, blocks, reports, in-app notifications and push tokens.

-- ===========================================================================
-- Shared internal helpers
-- ===========================================================================

-- Blocks come first: almost every policy below consults them.
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public._blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Throws when a user created too many rows recently (anti-spam).
create or replace function public._enforce_rate_limit(
  p_table regclass,
  p_user_col text,
  p_user uuid,
  p_window interval,
  p_max int,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  execute format('select count(*) from %s where %I = $1 and created_at > now() - $2', p_table, p_user_col)
    into n using p_user, p_window;
  if n >= p_max then
    raise exception 'Slow down: too many % right now. Try again a little later.', p_label
      using errcode = 'P0001';
  end if;
end;
$$;

-- ===========================================================================
-- Blocks (needed by almost every policy below)
-- ===========================================================================

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists blocks_select_own on public.blocks;
drop policy if exists blocks_insert_own on public.blocks;
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

revoke update on public.blocks from anon, authenticated;

-- Client-safe: only reveals blocks that involve the caller.
create or replace function public.blocked_with_me(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._blocked_between(auth.uid(), p_other)
$$;

revoke all on function public._blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public._enforce_rate_limit(regclass, text, uuid, interval, int, text) from public, anon, authenticated;
revoke all on function public.blocked_with_me(uuid) from public, anon;
grant execute on function public.blocked_with_me(uuid) to authenticated;

-- ===========================================================================
-- Profiles v2
-- ===========================================================================

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists avatar_path text,
  add column if not exists home_country text,
  add column if not exists travel_styles text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists is_discoverable boolean not null default true,
  add column if not exists allow_messages text not null default 'everyone',
  add column if not exists guidelines_accepted_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists verified_km numeric(10, 2) not null default 0,
  add column if not exists max_altitude_m numeric(8, 1) not null default 0,
  add column if not exists trips_count int not null default 0,
  add column if not exists followers_count int not null default 0,
  add column if not exists following_count int not null default 0,
  add column if not exists posts_count int not null default 0,
  add column if not exists stats_updated_at timestamptz;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,24}$');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_bio_length check (bio is null or char_length(bio) <= 280);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_allow_messages_check check (allow_messages in ('everyone', 'following', 'none'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 60);
exception when duplicate_object then null;
end $$;

create unique index if not exists profiles_username_key on public.profiles (username);

create or replace function public.generate_username(p_seed text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  base text := lower(regexp_replace(coalesce(p_seed, ''), '[^a-zA-Z0-9_]', '', 'g'));
  candidate text;
  i int := 0;
begin
  if char_length(base) < 3 then
    base := 'traveller';
  end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    if i > 40 then
      return 'traveller_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    end if;
    candidate := base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_username(text) from public, anon, authenticated;

-- Signup trigger: create the profile with a unique handle (username can be chosen at signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'traveller'), '@', 1)
  ), 60);
  v_seed text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, 'traveller'), '@', 1)
  );
  attempt int := 0;
begin
  loop
    begin
      insert into public.profiles (id, display_name, username)
      values (new.id, v_name, public.generate_username(v_seed))
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt >= 5 then
        insert into public.profiles (id, display_name) values (new.id, v_name) on conflict (id) do nothing;
        exit;
      end if;
    end;
  end loop;
  return new;
end;
$$;

-- Backfill handles for existing travellers, one row at a time so each sees the previous.
do $$
declare
  r record;
begin
  for r in select id, display_name from public.profiles where username is null loop
    update public.profiles
    set username = public.generate_username(coalesce(r.display_name, 'traveller'))
    where id = r.id;
  end loop;
end $$;

-- Authenticated travellers can see each other (except across a block).
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
  for select to authenticated
  using (id = auth.uid() or not public.blocked_with_me(id));

-- Verified stats, tier and counters are server-maintained: clients may only edit these columns.
revoke insert, update on public.profiles from anon, authenticated;
grant update (
  display_name, home_region, privacy_default, username, bio, avatar_path, home_country,
  travel_styles, languages, is_discoverable, allow_messages, guidelines_accepted_at, last_active_at,
  updated_at
) on public.profiles to authenticated;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[a-z0-9_.]{3,24}$'
    and not exists (
      select 1 from public.profiles
      where username = p_username and id is distinct from auth.uid()
    )
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ===========================================================================
-- Notifications (written only by triggers / definer functions)
-- ===========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'follow', 'like', 'comment', 'board_request', 'board_accepted', 'board_declined',
    'trip_match', 'tip_upvote', 'crew_join', 'system'
  )),
  entity_type text,
  entity_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public._notify(
  p_user uuid,
  p_actor uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_user is not distinct from p_actor then
    return;
  end if;
  if p_actor is not null and public._blocked_between(p_user, p_actor) then
    return;
  end if;
  -- Collapse repeats (e.g. like / unlike / like) within a day.
  if exists (
    select 1 from public.notifications
    where user_id = p_user
      and actor_id is not distinct from p_actor
      and kind = p_kind
      and entity_id is not distinct from p_entity_id
      and created_at > now() - interval '1 day'
  ) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, entity_type, entity_id, body)
  values (p_user, p_actor, p_kind, p_entity_type, p_entity_id, left(p_body, 200));
end;
$$;

revoke all on function public._notify(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;

create or replace function public.mark_notifications_read()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Push tokens (Expo). Registered through a definer RPC so a device can switch accounts.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated using (user_id = auth.uid());

revoke insert, update on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or char_length(p_token) < 10 or char_length(p_token) > 300 then
    raise exception 'invalid push token';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), left(p_platform, 20), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ===========================================================================
-- Follows
-- ===========================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists follows_select_visible on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_select_visible on public.follows for select to authenticated
  using (not public.blocked_with_me(follower_id) and not public.blocked_with_me(followee_id));
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.blocked_with_me(followee_id));
-- Unfollow, or remove one of your own followers.
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

revoke update on public.follows from anon, authenticated;

create or replace function public.on_follow_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.follows', 'follower_id', new.follower_id, interval '1 hour', 200, 'follows');
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    perform public._notify(new.followee_id, new.follower_id, 'follow', 'profile', new.follower_id);
    return new;
  end if;
  update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
  update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  return old;
end;
$$;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.on_follow_before_insert();

drop trigger if exists follows_counts on public.follows;
create trigger follows_counts after insert or delete on public.follows
  for each row execute function public.on_follow_change();

-- Blocking someone also removes follows in both directions.
create or replace function public.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_cleanup on public.blocks;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block_created();

-- ===========================================================================
-- Posts (moments, trip stories, milestones)
-- ===========================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'moment' check (kind in ('moment', 'trip', 'milestone')),
  body text check (body is null or char_length(body) <= 2000),
  trip_id uuid references public.trips (id) on delete set null,
  entry_id uuid references public.entries (id) on delete set null,
  place_name text check (place_name is null or char_length(place_name) <= 120),
  place_key text check (place_key is null or place_key ~ '^[a-z0-9-]{2,60}$'),
  latitude double precision,
  longitude double precision,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  media jsonb not null default '[]'::jsonb,
  include_route boolean not null default false,
  route_km numeric(10, 2),
  route_preview jsonb,
  stats jsonb,
  like_count int not null default 0,
  comment_count int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  check (coalesce(char_length(trim(body)), 0) > 0 or jsonb_array_length(media) > 0 or include_route)
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
create index if not exists posts_place_idx on public.posts (place_key, created_at desc);

alter table public.posts enable row level security;

drop policy if exists posts_select_visible on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
create policy posts_select_visible on public.posts for select to authenticated
  using (
    user_id = auth.uid() or (
      not hidden
      and not public.blocked_with_me(user_id)
      and (
        visibility = 'public'
        or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = posts.user_id)
      )
    )
  );
create policy posts_insert_own on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_update_own on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete_own on public.posts for delete to authenticated using (user_id = auth.uid());

revoke update on public.posts from anon, authenticated;
grant update (body, place_name, place_key, visibility, updated_at) on public.posts to authenticated;

create or replace function public.on_post_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.posts', 'user_id', new.user_id, interval '1 hour', 20, 'posts');
  if new.trip_id is not null and not exists (
    select 1 from public.trips where id = new.trip_id and user_id = new.user_id
  ) then
    raise exception 'You can only link your own trips';
  end if;
  if new.entry_id is not null and not exists (
    select 1 from public.entries where id = new.entry_id and user_id = new.user_id
  ) then
    raise exception 'You can only link your own journal entries';
  end if;
  -- Server-verified route: computed from the author's own GPS track, never trusted from the client.
  if new.include_route and new.trip_id is not null then
    new.route_km := public.trip_route_km(new.trip_id);
    new.route_preview := public.trip_route_preview(new.trip_id, 80);
  else
    new.include_route := false;
    new.route_km := null;
    new.route_preview := null;
  end if;
  -- Coarsen any attached coordinates (~100 m).
  new.latitude := round(new.latitude::numeric, 3);
  new.longitude := round(new.longitude::numeric, 3);
  new.like_count := 0;
  new.comment_count := 0;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.on_post_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.user_id;
    return new;
  end if;
  update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.on_post_before_insert();

drop trigger if exists posts_counts on public.posts;
create trigger posts_counts after insert or delete on public.posts
  for each row execute function public.on_post_change();

-- Likes ---------------------------------------------------------------------

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

drop policy if exists post_likes_select on public.post_likes;
drop policy if exists post_likes_insert_own on public.post_likes;
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_insert_own on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_delete_own on public.post_likes for delete to authenticated using (user_id = auth.uid());

revoke update on public.post_likes from anon, authenticated;

create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id returning user_id into v_author;
    perform public._notify(v_author, new.user_id, 'like', 'post', new.post_id);
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_counts on public.post_likes;
create trigger post_likes_counts after insert or delete on public.post_likes
  for each row execute function public.on_like_change();

-- Comments ------------------------------------------------------------------

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_select on public.post_comments;
drop policy if exists post_comments_insert_own on public.post_comments;
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_select on public.post_comments for select to authenticated
  using (
    user_id = auth.uid() or (
      not hidden
      and not public.blocked_with_me(user_id)
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );
create policy post_comments_insert_own on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
-- Authors can delete their comment; post owners can remove comments on their post.
create policy post_comments_delete on public.post_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

revoke update on public.post_comments from anon, authenticated;

create or replace function public.on_comment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.post_comments', 'user_id', new.user_id, interval '10 minutes', 30, 'comments');
  new.body := trim(new.body);
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning user_id into v_author;
    perform public._notify(v_author, new.user_id, 'comment', 'post', new.post_id, new.body);
    return new;
  end if;
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_comments_before_insert on public.post_comments;
create trigger post_comments_before_insert before insert on public.post_comments
  for each row execute function public.on_comment_before_insert();

drop trigger if exists post_comments_counts on public.post_comments;
create trigger post_comments_counts after insert or delete on public.post_comments
  for each row execute function public.on_comment_change();

-- ===========================================================================
-- Reports (App Store 1.2: users can flag objectionable content; 3 reports auto-hide it)
-- ===========================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in (
    'post', 'comment', 'message', 'profile', 'tip', 'board_post', 'conversation'
  )),
  target_id uuid not null,
  reason text not null check (reason in (
    'spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'unsafe', 'impersonation', 'other'
  )),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_select_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());

revoke update, delete on public.reports from anon, authenticated;

create or replace function public.on_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hide_at constant int := 3;
begin
  perform public._enforce_rate_limit('public.reports', 'reporter_id', new.reporter_id, interval '1 hour', 30, 'reports');
  case new.target_type
    when 'post' then
      update public.posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'comment' then
      update public.post_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    else
      -- Connect tables (messages, tips, board posts, rooms) are handled in the connect migration.
      null;
  end case;
  return new;
end;
$$;

drop trigger if exists reports_apply on public.reports;
create trigger reports_apply after insert on public.reports
  for each row execute function public.on_report_created();

-- ===========================================================================
-- Storage: public avatars + post media (UUID paths, owner-folder writes)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists social_media_insert_own on storage.objects;
drop policy if exists social_media_update_own on storage.objects;
drop policy if exists social_media_delete_own on storage.objects;
drop policy if exists social_media_select_own on storage.objects;
create policy social_media_select_own on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_update_own on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);

-- ===========================================================================
-- Read models (security invoker: RLS above decides what each traveller can see)
-- ===========================================================================

create or replace function public.feed_page(
  p_mode text default 'following',
  p_place_key text default null,
  p_user uuid default null,
  p_before timestamptz default null,
  p_limit int default 20,
  p_offset int default 0,
  p_post uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  body text,
  trip_id uuid,
  place_name text,
  place_key text,
  latitude double precision,
  longitude double precision,
  visibility text,
  media jsonb,
  route_km numeric,
  route_preview jsonb,
  stats jsonb,
  like_count int,
  comment_count int,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  liked_by_me boolean,
  following_author boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.user_id, p.kind, p.body, p.trip_id, p.place_name, p.place_key, p.latitude, p.longitude,
    p.visibility, p.media, p.route_km, p.route_preview, p.stats, p.like_count, p.comment_count, p.created_at,
    pr.username, pr.display_name, pr.avatar_path, pr.tier,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id)
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where (p_before is null or p.created_at < p_before)
    and case p_mode
      when 'following' then
        p.user_id = auth.uid()
        or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id)
      when 'discover' then p.visibility = 'public'
      when 'trending' then p.visibility = 'public' and p.created_at > now() - interval '14 days'
      when 'place' then p.visibility = 'public' and p.place_key = p_place_key
      when 'user' then p.user_id = p_user
      when 'post' then p.id = p_post
      else false
    end
  order by
    case when p_mode = 'trending' then p.like_count * 2 + p.comment_count * 3 else 0 end desc,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.post_comments_page(p_post uuid, p_limit int default 200)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.post_id, c.user_id, c.body, c.created_at, pr.username, pr.display_name, pr.avatar_path, pr.tier
  from public.post_comments c
  join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
  order by c.created_at asc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

-- Public profile card, by id or by @username.
create or replace function public.get_profile(p_user uuid default null, p_username text default null)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_path text,
  home_region text,
  home_country text,
  travel_styles text[],
  languages text[],
  tier text,
  verified_km numeric,
  max_altitude_m numeric,
  trips_count int,
  followers_count int,
  following_count int,
  posts_count int,
  last_active_at timestamptz,
  created_at timestamptz,
  followed_by_me boolean,
  follows_me boolean,
  can_message boolean,
  is_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.username, p.display_name, p.bio, p.avatar_path, p.home_region, p.home_country,
    p.travel_styles, p.languages, p.tier, p.verified_km, p.max_altitude_m, p.trips_count,
    p.followers_count, p.following_count, p.posts_count, p.last_active_at, p.created_at,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = auth.uid()),
    p.id <> auth.uid() and (
      p.allow_messages = 'everyone'
      or (p.allow_messages = 'following'
          and exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = auth.uid()))
    ),
    p.id = auth.uid()
  from public.profiles p
  where (p_user is not null and p.id = p_user)
     or (p_user is null and p_username is not null and p.username = lower(p_username))
  limit 1
$$;

create or replace function public.search_travellers(p_query text, p_limit int default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  home_region text,
  travel_styles text[],
  followers_count int,
  followed_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, p.home_region, p.travel_styles, p.followers_count,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from public.profiles p
  where p.id <> auth.uid()
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and (
      p.is_discoverable
      or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
    )
    and (
      p.username ilike '%' || replace(replace(lower(trim(p_query)), '%', ''), '_', '\_') || '%'
      or p.display_name ilike '%' || replace(trim(p_query), '%', '') || '%'
    )
  order by (p.username = lower(trim(p_query))) desc, p.followers_count desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.suggested_travellers(p_limit int default 12)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  home_region text,
  travel_styles text[],
  followers_count int,
  shared_styles int
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select travel_styles, home_region from public.profiles where id = auth.uid()
  )
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, p.home_region, p.travel_styles, p.followers_count,
    (select count(*)::int from unnest(p.travel_styles) s where s = any (coalesce((select travel_styles from me), '{}'::text[])))
  from public.profiles p
  where p.id <> auth.uid()
    and p.is_discoverable
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  order by 9 desc, (p.home_region is not distinct from (select home_region from me)) desc,
    p.followers_count desc, p.last_active_at desc nulls last
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
$$;

create or replace function public.list_follows(
  p_user uuid,
  p_direction text default 'followers',
  p_before timestamptz default null,
  p_limit int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  followed_at timestamptz,
  followed_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, f.created_at,
    exists (select 1 from public.follows mf where mf.follower_id = auth.uid() and mf.followee_id = p.id)
  from public.follows f
  join public.profiles p on p.id = case when p_direction = 'following' then f.followee_id else f.follower_id end
  where (case when p_direction = 'following' then f.follower_id else f.followee_id end) = p_user
    and (p_before is null or f.created_at < p_before)
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- The blocker still needs names to manage their block list (profiles RLS hides both ways).
create or replace function public.my_blocked_profiles()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;

create or replace function public.notifications_page(p_before timestamptz default null, p_limit int default 40)
returns table (
  id uuid,
  kind text,
  entity_type text,
  entity_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_avatar_path text
)
language sql
stable
security invoker
set search_path = public
as $$
  select n.id, n.kind, n.entity_type, n.entity_id, n.body, n.read_at, n.created_at,
    n.actor_id, a.username, a.display_name, a.avatar_path
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.user_id = auth.uid() and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.feed_page(text, text, uuid, timestamptz, int, int, uuid)',
    'public.post_comments_page(uuid, int)',
    'public.get_profile(uuid, text)',
    'public.search_travellers(text, int)',
    'public.suggested_travellers(int)',
    'public.list_follows(uuid, text, timestamptz, int)',
    'public.notifications_page(timestamptz, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Trigger functions are never called directly.
revoke all on function public.on_follow_before_insert() from public, anon, authenticated;
revoke all on function public.on_follow_change() from public, anon, authenticated;
revoke all on function public.on_block_created() from public, anon, authenticated;
revoke all on function public.on_post_before_insert() from public, anon, authenticated;
revoke all on function public.on_post_change() from public, anon, authenticated;
revoke all on function public.on_like_change() from public, anon, authenticated;
revoke all on function public.on_comment_before_insert() from public, anon, authenticated;
revoke all on function public.on_comment_change() from public, anon, authenticated;
revoke all on function public.on_report_created() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Live notification badge.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ===== migrations/20261006020000_wayfare_connect.sql =====
-- Wayfare Connect: chats (direct, crew groups, destination rooms), the travel board
-- (buddies / meetups / ride shares / stay shares), place tips, opt-in nearby presence
-- and "who's going where you're going" trip matching.

-- ===========================================================================
-- Conversations
-- ===========================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group', 'place')),
  title text check (title is null or char_length(title) <= 80),
  place_key text check (place_key is null or place_key ~ '^[a-z0-9-]{2,60}$'),
  direct_key text unique,
  trip_id uuid,
  board_post_id uuid,
  invite_code text unique,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  member_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists conversations_place_room_idx on public.conversations (place_key) where kind = 'place';
create index if not exists conversations_last_msg_idx on public.conversations (last_message_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'location', 'system')),
  body text check (body is null or char_length(body) <= 4000),
  media_path text,
  latitude double precision,
  longitude double precision,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    coalesce(char_length(trim(body)), 0) > 0
    or media_path is not null
    or (latitude is not null and longitude is not null)
  )
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = auth.uid()
  )
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated
  using (kind = 'place' or public.is_conversation_member(id));

-- Conversations are created / changed only through the RPCs below.
revoke insert, update, delete on public.conversations from anon, authenticated;

drop policy if exists conversation_members_select on public.conversation_members;
drop policy if exists conversation_members_update_own on public.conversation_members;
drop policy if exists conversation_members_delete_own on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy conversation_members_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conversation_members_delete_own on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());

revoke insert, update on public.conversation_members from anon, authenticated;
grant update (last_read_at, muted) on public.conversation_members to authenticated;

drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete_own on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and (sender_id = auth.uid() or (not hidden and not public.blocked_with_me(sender_id)))
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind <> 'system'
    and public.is_conversation_member(conversation_id)
  );
create policy messages_delete_own on public.messages for delete to authenticated using (sender_id = auth.uid());

revoke update on public.messages from anon, authenticated;

create or replace function public.on_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  if new.kind <> 'system' then
    perform public._enforce_rate_limit('public.messages', 'sender_id', new.sender_id, interval '1 minute', 30, 'messages');
    select * into v_conv from public.conversations where id = new.conversation_id;
    -- Check both participants of a direct chat, even one who left it.
    if v_conv.kind = 'direct' and exists (
      select 1 from unnest(string_to_array(v_conv.direct_key, ':')) as u
      where u::uuid <> new.sender_id and public._blocked_between(u::uuid, new.sender_id)
    ) then
      raise exception 'You cannot message this traveller';
    end if;
  end if;
  if new.kind = 'location' then
    new.latitude := round(new.latitude::numeric, 4);
    new.longitude := round(new.longitude::numeric, 4);
  end if;
  new.body := nullif(trim(new.body), '');
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  -- Leaving a direct chat hides it; a new message brings it back for both sides.
  if v_conv.kind = 'direct' and v_conv.direct_key is not null then
    insert into public.conversation_members (conversation_id, user_id, last_read_at)
    select new.conversation_id, u::uuid, new.created_at - interval '1 second'
    from unnest(string_to_array(v_conv.direct_key, ':')) as u
    where exists (select 1 from public.profiles p where p.id = u::uuid)
    on conflict do nothing;
  end if;
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(case new.kind
        when 'image' then '📷 Photo'
        when 'location' then '📍 Location'
        else coalesce(new.body, '')
      end, 140)
  where id = new.conversation_id;
  update public.conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.on_message_before_insert();

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_inserted();

-- Keeps member counts, hands a group to the next member when its owner leaves (or deletes
-- their account) and removes groups nobody is left in.
create or replace function public.on_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_next uuid;
begin
  if tg_op = 'INSERT' then
    update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
    return new;
  end if;
  update public.conversations set member_count = greatest(member_count - 1, 0)
  where id = old.conversation_id
  returning kind into v_kind;
  if v_kind = 'group' then
    if not exists (select 1 from public.conversation_members where conversation_id = old.conversation_id) then
      delete from public.conversations where id = old.conversation_id;
    elsif old.role = 'owner' and not exists (
      select 1 from public.conversation_members where conversation_id = old.conversation_id and role = 'owner'
    ) then
      select user_id into v_next from public.conversation_members
      where conversation_id = old.conversation_id
      order by (role = 'admin') desc, joined_at asc
      limit 1;
      update public.conversation_members set role = 'owner'
      where conversation_id = old.conversation_id and user_id = v_next;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists conversation_members_count on public.conversation_members;
create trigger conversation_members_count after insert or delete on public.conversation_members
  for each row execute function public.on_member_change();

-- Private chat photos: <conversation_id>/<uuid>.jpg, readable by members only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path-safe membership check (no uuid cast errors on unexpected object names).
create or replace function public.is_conversation_member_path(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text := split_part(p_name, '/', 1);
begin
  if p_bucket <> 'chat-media' or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(folder::uuid);
end;
$$;

revoke all on function public.is_conversation_member_path(text, text) from public, anon;
grant execute on function public.is_conversation_member_path(text, text) to authenticated;

drop policy if exists chat_media_select_member on storage.objects;
drop policy if exists chat_media_insert_member on storage.objects;
create policy chat_media_select_member on storage.objects for select to authenticated
  using (public.is_conversation_member_path(bucket_id, name));
create policy chat_media_insert_member on storage.objects for insert to authenticated
  with check (public.is_conversation_member_path(bucket_id, name));

-- Helpers ----------------------------------------------------------------------

create or replace function public._new_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  code text;
begin
  loop
    -- md5 hex minus 0/1 -> 14 unambiguous symbols; avoids pgcrypto (lives in `extensions` on Supabase).
    code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 8));
    exit when char_length(code) = 8 and not exists (select 1 from public.conversations where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public._system_message(p_conversation uuid, p_actor uuid, p_body text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.messages (conversation_id, sender_id, kind, body) values (p_conversation, p_actor, 'system', p_body);
$$;

create or replace function public._can_message(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_sender <> p_recipient
    and not public._blocked_between(p_sender, p_recipient)
    and exists (
      select 1 from public.profiles p
      where p.id = p_recipient
        and (
          p.allow_messages = 'everyone'
          or (p.allow_messages = 'following'
              and exists (select 1 from public.follows f where f.follower_id = p_recipient and f.followee_id = p_sender))
        )
    )
$$;

revoke all on function public._new_invite_code() from public, anon, authenticated;
revoke all on function public._system_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._can_message(uuid, uuid) from public, anon, authenticated;

-- RPCs -------------------------------------------------------------------------

create or replace function public.start_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_key text;
  v_id uuid;
  v_policy text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_other is null or p_other = me then
    raise exception 'Pick another traveller to message';
  end if;
  if public._blocked_between(me, p_other) then
    raise exception 'You cannot message this traveller';
  end if;
  select allow_messages into v_policy from public.profiles where id = p_other;
  if not found then
    raise exception 'Traveller not found';
  end if;
  v_key := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is null then
    if not public._can_message(me, p_other) then
      if v_policy = 'none' then
        raise exception 'This traveller is not accepting messages';
      end if;
      raise exception 'This traveller only accepts messages from people they follow';
    end if;
    insert into public.conversations (kind, direct_key, created_by) values ('direct', v_key, me) returning id into v_id;
  end if;
  -- (Re)join both sides: leaving a direct chat only hides it until the next message.
  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, me, 'member'), (v_id, p_other, 'member')
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[] default '{}',
  p_trip_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_member uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Give your crew chat a name';
  end if;
  perform public._enforce_rate_limit('public.conversations', 'created_by', me, interval '1 day', 20, 'group chats');
  insert into public.conversations (kind, title, trip_id, invite_code, created_by)
  values ('group', left(trim(p_title), 80), p_trip_id, public._new_invite_code(), me)
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, role) values (v_id, me, 'owner');
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if public._can_message(me, v_member) then
      insert into public.conversation_members (conversation_id, user_id) values (v_id, v_member) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.join_conversation_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_conv public.conversations;
  v_name text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select * into v_conv from public.conversations where invite_code = upper(trim(p_code)) and kind = 'group';
  if not found then
    raise exception 'That invite code is not valid';
  end if;
  if public._blocked_between(me, v_conv.created_by) then
    raise exception 'That invite code is not valid';
  end if;
  if v_conv.member_count >= 100 then
    raise exception 'This crew is full';
  end if;
  if not exists (select 1 from public.conversation_members where conversation_id = v_conv.id and user_id = me) then
    insert into public.conversation_members (conversation_id, user_id) values (v_conv.id, me);
    select coalesce(display_name, username, 'A traveller') into v_name from public.profiles where id = me;
    perform public._system_message(v_conv.id, me, v_name || ' joined the crew');
    perform public._notify(v_conv.created_by, me, 'crew_join', 'conversation', v_conv.id, v_conv.title);
  end if;
  return v_conv.id;
end;
$$;

create or replace function public.join_place_room(p_place_key text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_place_key !~ '^[a-z0-9-]{2,60}$' then
    raise exception 'Invalid place';
  end if;
  select id into v_id from public.conversations where kind = 'place' and place_key = p_place_key;
  if v_id is null then
    insert into public.conversations (kind, title, place_key, created_by)
    values ('place', left(coalesce(nullif(trim(p_title), ''), p_place_key), 80), p_place_key, me)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where kind = 'place' and place_key = p_place_key;
    end if;
  end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, me) on conflict do nothing;
  return v_id;
end;
$$;

-- Leaving a group hands ownership on (see on_member_change); leaving a direct chat hides it.
create or replace function public.leave_conversation(p_conversation uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.conversation_members where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.remove_conversation_member(p_conversation uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation and m.user_id = auth.uid()
      and m.role in ('owner', 'admin') and c.kind = 'group'
  ) then
    raise exception 'Only crew admins can remove members';
  end if;
  if p_user = auth.uid() then
    raise exception 'Use leave instead';
  end if;
  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = p_user and role <> 'owner';
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.my_conversations()
returns table (
  id uuid,
  kind text,
  title text,
  place_key text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz,
  member_count int,
  muted boolean,
  role text,
  unread_count int,
  invite_code text,
  trip_id uuid,
  board_post_id uuid,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.kind, c.title, c.place_key, c.last_message_at, c.last_message_preview, c.created_at, c.member_count,
    m.muted, m.role,
    (select count(*)::int from public.messages msg
      where msg.conversation_id = c.id and msg.created_at > m.last_read_at and msg.sender_id <> auth.uid()),
    c.invite_code, c.trip_id, c.board_post_id,
    o.user_id, op.username, op.display_name, op.avatar_path
  from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  left join lateral (
    select om.user_id from public.conversation_members om
    where om.conversation_id = c.id and om.user_id <> auth.uid() and c.kind = 'direct'
    limit 1
  ) o on true
  left join public.profiles op on op.id = o.user_id
  where m.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

create or replace function public.conversation_members_list(p_conversation uuid)
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  username text,
  display_name text,
  avatar_path text,
  tier text
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.user_id, m.role, m.joined_at, p.username, p.display_name, p.avatar_path, p.tier
  from public.conversation_members m
  left join public.profiles p on p.id = m.user_id
  where m.conversation_id = p_conversation
  order by (m.role = 'owner') desc, m.joined_at asc
  limit 500
$$;

create or replace function public.conversation_messages(
  p_conversation uuid,
  p_before timestamptz default null,
  p_limit int default 50
)
returns setof public.messages
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.messages
  where conversation_id = p_conversation and (p_before is null or created_at < p_before)
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

create or replace function public.place_rooms(p_query text default null, p_limit int default 30)
returns table (
  id uuid,
  title text,
  place_key text,
  member_count int,
  last_message_at timestamptz,
  last_message_preview text,
  joined boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.title, c.place_key, c.member_count, c.last_message_at,
    case when public.is_conversation_member(c.id) then c.last_message_preview end,
    public.is_conversation_member(c.id)
  from public.conversations c
  where c.kind = 'place'
    and (
      p_query is null or char_length(trim(p_query)) = 0
      or c.title ilike '%' || replace(trim(p_query), '%', '') || '%'
      or c.place_key ilike '%' || replace(trim(p_query), '%', '') || '%'
    )
  order by c.member_count desc, c.last_message_at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- ===========================================================================
-- Travel board: buddies, meetups, ride shares, stay shares
-- ===========================================================================

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('buddy', 'meetup', 'ride', 'stay')),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text check (body is null or char_length(body) <= 2000),
  place_name text not null check (char_length(trim(place_name)) between 2 and 120),
  place_key text not null check (place_key ~ '^[a-z0-9-]{2,60}$'),
  starts_on date,
  ends_on date,
  meet_at timestamptz,
  spots int not null default 1 check (spots between 1 and 50),
  budget_level text check (budget_level is null or budget_level in ('shoestring', 'moderate', 'comfort')),
  status text not null default 'open' check (status in ('open', 'full', 'closed')),
  accepted_count int not null default 0,
  pending_count int not null default 0,
  conversation_id uuid references public.conversations (id) on delete set null,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists board_posts_created_idx on public.board_posts (created_at desc);
create index if not exists board_posts_place_idx on public.board_posts (place_key, created_at desc);

do $$
begin
  alter table public.conversations
    add constraint conversations_board_post_fk foreign key (board_post_id)
    references public.board_posts (id) on delete set null;
exception when duplicate_object then null;
end $$;

alter table public.board_posts enable row level security;

drop policy if exists board_posts_select on public.board_posts;
drop policy if exists board_posts_insert_own on public.board_posts;
drop policy if exists board_posts_update_own on public.board_posts;
drop policy if exists board_posts_delete_own on public.board_posts;
create policy board_posts_select on public.board_posts for select to authenticated
  using (user_id = auth.uid() or (not hidden and not public.blocked_with_me(user_id)));
create policy board_posts_insert_own on public.board_posts for insert to authenticated with check (user_id = auth.uid());
create policy board_posts_update_own on public.board_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy board_posts_delete_own on public.board_posts for delete to authenticated using (user_id = auth.uid());

revoke update on public.board_posts from anon, authenticated;
grant update (title, body, place_name, place_key, starts_on, ends_on, meet_at, spots, budget_level, status, updated_at)
  on public.board_posts to authenticated;

create or replace function public.on_board_post_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.board_posts', 'user_id', new.user_id, interval '1 day', 10, 'board posts');
  new.title := trim(new.title);
  new.status := 'open';
  new.accepted_count := 0;
  new.pending_count := 0;
  new.conversation_id := null;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists board_posts_before_insert on public.board_posts;
create trigger board_posts_before_insert before insert on public.board_posts
  for each row execute function public.on_board_post_before_insert();

create table if not exists public.board_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists board_requests_post_idx on public.board_requests (post_id, created_at);

alter table public.board_requests enable row level security;

drop policy if exists board_requests_select on public.board_requests;
drop policy if exists board_requests_insert_own on public.board_requests;
drop policy if exists board_requests_delete_own on public.board_requests;
create policy board_requests_select on public.board_requests for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.board_posts b where b.id = post_id and b.user_id = auth.uid())
  );
create policy board_requests_insert_own on public.board_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.board_posts b
      where b.id = post_id and b.status = 'open' and b.user_id <> auth.uid()
        and not b.hidden and not public.blocked_with_me(b.user_id)
    )
  );
-- Withdraw a pending request.
create policy board_requests_delete_own on public.board_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

revoke update on public.board_requests from anon, authenticated;

create or replace function public.on_board_request_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.board_requests', 'user_id', new.user_id, interval '1 hour', 30, 'requests');
  new.status := 'pending';
  new.message := nullif(trim(new.message), '');
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.on_board_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  if tg_op = 'INSERT' then
    update public.board_posts set pending_count = pending_count + 1 where id = new.post_id
    returning user_id, title into v_owner, v_title;
    perform public._notify(v_owner, new.user_id, 'board_request', 'board_post', new.post_id, v_title);
    return new;
  end if;
  if old.status = 'pending' then
    update public.board_posts set pending_count = greatest(pending_count - 1, 0) where id = old.post_id;
  end if;
  return old;
end;
$$;

drop trigger if exists board_requests_before_insert on public.board_requests;
create trigger board_requests_before_insert before insert on public.board_requests
  for each row execute function public.on_board_request_before_insert();

drop trigger if exists board_requests_counts on public.board_requests;
create trigger board_requests_counts after insert or delete on public.board_requests
  for each row execute function public.on_board_request_change();

-- Accept (adds the traveller to the crew chat) or decline a join request.
create or replace function public.respond_board_request(p_request uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_req public.board_requests;
  v_post public.board_posts;
  v_conv uuid;
  v_name text;
begin
  select * into v_req from public.board_requests where id = p_request for update;
  if not found then
    raise exception 'Request not found';
  end if;
  select * into v_post from public.board_posts where id = v_req.post_id for update;
  if v_post.user_id is distinct from me then
    raise exception 'Only the organiser can respond';
  end if;
  if v_req.status <> 'pending' then
    return v_post.conversation_id;
  end if;

  if not p_accept then
    update public.board_requests set status = 'declined', updated_at = now() where id = p_request;
    update public.board_posts set pending_count = greatest(pending_count - 1, 0) where id = v_post.id;
    perform public._notify(v_req.user_id, me, 'board_declined', 'board_post', v_post.id, v_post.title);
    return null;
  end if;

  if v_post.accepted_count >= v_post.spots then
    raise exception 'No spots left — increase spots to accept more travellers';
  end if;
  if public._blocked_between(me, v_req.user_id) then
    raise exception 'You cannot add this traveller';
  end if;

  v_conv := v_post.conversation_id;
  if v_conv is null then
    insert into public.conversations (kind, title, board_post_id, invite_code, created_by)
    values ('group', left(v_post.title, 80), v_post.id, public._new_invite_code(), me)
    returning id into v_conv;
    insert into public.conversation_members (conversation_id, user_id, role) values (v_conv, me, 'owner');
  end if;

  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_req.user_id)
  on conflict do nothing;
  select coalesce(display_name, username, 'A traveller') into v_name from public.profiles where id = v_req.user_id;
  perform public._system_message(v_conv, v_req.user_id, v_name || ' joined the crew');

  update public.board_requests set status = 'accepted', updated_at = now() where id = p_request;
  update public.board_posts
  set accepted_count = accepted_count + 1,
      pending_count = greatest(pending_count - 1, 0),
      conversation_id = v_conv,
      status = case when accepted_count + 1 >= spots then 'full' else status end,
      updated_at = now()
  where id = v_post.id;

  perform public._notify(v_req.user_id, me, 'board_accepted', 'board_post', v_post.id, v_post.title);
  return v_conv;
end;
$$;

create or replace function public.board_page(
  p_kind text default null,
  p_place_key text default null,
  p_mine boolean default false,
  p_before timestamptz default null,
  p_limit int default 20,
  p_post uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  title text,
  body text,
  place_name text,
  place_key text,
  starts_on date,
  ends_on date,
  meet_at timestamptz,
  spots int,
  budget_level text,
  status text,
  accepted_count int,
  pending_count int,
  conversation_id uuid,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  my_request_status text
)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id, b.user_id, b.kind, b.title, b.body, b.place_name, b.place_key, b.starts_on, b.ends_on, b.meet_at,
    b.spots, b.budget_level, b.status, b.accepted_count,
    case when b.user_id = auth.uid() then b.pending_count else 0 end,
    case when b.user_id = auth.uid()
           or exists (select 1 from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid() and r.status = 'accepted')
         then b.conversation_id end,
    b.created_at, pr.username, pr.display_name, pr.avatar_path, pr.tier,
    (select r.status from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid())
  from public.board_posts b
  join public.profiles pr on pr.id = b.user_id
  where (p_post is not null and b.id = p_post)
    or (
      p_post is null
      and (p_kind is null or b.kind = p_kind)
      and (p_place_key is null or b.place_key = p_place_key)
      and (p_before is null or b.created_at < p_before)
      and (
        (p_mine and (
          b.user_id = auth.uid()
          or exists (select 1 from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid())
        ))
        or (not p_mine
          and b.status <> 'closed'
          and coalesce(b.ends_on, b.starts_on, (b.meet_at at time zone 'utc')::date, current_date) >= current_date - 1)
      )
    )
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.board_requests_for_post(p_post uuid)
returns table (
  id uuid,
  user_id uuid,
  message text,
  status text,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.user_id, r.message, r.status, r.created_at, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles
  from public.board_requests r
  join public.profiles p on p.id = r.user_id
  where r.post_id = p_post
  order by (r.status = 'pending') desc, r.created_at asc
$$;

-- ===========================================================================
-- Place tips (community knowledge per destination)
-- ===========================================================================

create table if not exists public.place_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_key text not null check (place_key ~ '^[a-z0-9-]{2,60}$'),
  place_name text,
  category text not null default 'general' check (category in (
    'general', 'stay', 'food', 'water', 'transport', 'permit', 'safety', 'gear', 'connectivity', 'money'
  )),
  body text not null check (char_length(trim(body)) between 3 and 1000),
  upvotes int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists place_tips_place_idx on public.place_tips (place_key, upvotes desc, created_at desc);

create table if not exists public.place_tip_votes (
  tip_id uuid not null references public.place_tips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);

alter table public.place_tips enable row level security;
alter table public.place_tip_votes enable row level security;

drop policy if exists place_tips_select on public.place_tips;
drop policy if exists place_tips_insert_own on public.place_tips;
drop policy if exists place_tips_delete_own on public.place_tips;
create policy place_tips_select on public.place_tips for select to authenticated
  using (user_id = auth.uid() or (not hidden and not public.blocked_with_me(user_id)));
create policy place_tips_insert_own on public.place_tips for insert to authenticated with check (user_id = auth.uid());
create policy place_tips_delete_own on public.place_tips for delete to authenticated using (user_id = auth.uid());

revoke update on public.place_tips from anon, authenticated;

drop policy if exists place_tip_votes_select on public.place_tip_votes;
drop policy if exists place_tip_votes_insert_own on public.place_tip_votes;
drop policy if exists place_tip_votes_delete_own on public.place_tip_votes;
create policy place_tip_votes_select on public.place_tip_votes for select to authenticated using (user_id = auth.uid());
create policy place_tip_votes_insert_own on public.place_tip_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.place_tips t where t.id = tip_id and t.user_id <> auth.uid())
  );
create policy place_tip_votes_delete_own on public.place_tip_votes for delete to authenticated using (user_id = auth.uid());

revoke update on public.place_tip_votes from anon, authenticated;

create or replace function public.on_tip_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.place_tips', 'user_id', new.user_id, interval '1 day', 30, 'tips');
  new.body := trim(new.body);
  new.upvotes := 0;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_tip_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_place text;
begin
  if tg_op = 'INSERT' then
    update public.place_tips set upvotes = upvotes + 1 where id = new.tip_id returning user_id, place_name into v_author, v_place;
    perform public._notify(v_author, new.user_id, 'tip_upvote', 'tip', new.tip_id, v_place);
    return new;
  end if;
  update public.place_tips set upvotes = greatest(upvotes - 1, 0) where id = old.tip_id;
  return old;
end;
$$;

drop trigger if exists place_tips_before_insert on public.place_tips;
create trigger place_tips_before_insert before insert on public.place_tips
  for each row execute function public.on_tip_before_insert();

drop trigger if exists place_tip_votes_counts on public.place_tip_votes;
create trigger place_tip_votes_counts after insert or delete on public.place_tip_votes
  for each row execute function public.on_tip_vote_change();

create or replace function public.place_tips_page(p_place_key text, p_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  place_key text,
  category text,
  body text,
  upvotes int,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  voted_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.user_id, t.place_key, t.category, t.body, t.upvotes, t.created_at,
    p.username, p.display_name, p.avatar_path, p.tier,
    exists (select 1 from public.place_tip_votes v where v.tip_id = t.id and v.user_id = auth.uid())
  from public.place_tips t
  join public.profiles p on p.id = t.user_id
  where t.place_key = p_place_key
  order by t.upvotes desc, t.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- ===========================================================================
-- Nearby travellers (opt-in, coarse ~1 km grid, expires, reciprocal)
-- ===========================================================================

create table if not exists public.presence (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  lat_coarse double precision not null check (lat_coarse between -90 and 90),
  lng_coarse double precision not null check (lng_coarse between -180 and 180),
  place_label text check (place_label is null or char_length(place_label) <= 80),
  status_text text check (status_text is null or char_length(status_text) <= 140),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);

create index if not exists presence_expires_idx on public.presence (expires_at);

alter table public.presence enable row level security;

drop policy if exists presence_own on public.presence;
create policy presence_own on public.presence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.on_presence_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.lat_coarse := round(new.lat_coarse::numeric, 2);
  new.lng_coarse := round(new.lng_coarse::numeric, 2);
  new.updated_at := now();
  new.expires_at := least(greatest(new.expires_at, now() + interval '15 minutes'), now() + interval '24 hours');
  return new;
end;
$$;

drop trigger if exists presence_coarsen on public.presence;
create trigger presence_coarsen before insert or update on public.presence
  for each row execute function public.on_presence_write();

create or replace function public._km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select public._haversine_m(lat1, lng1, lat2, lng2) / 1000.0
$$;

create or replace function public.nearby_travellers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 25,
  p_limit int default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[],
  place_label text,
  status_text text,
  distance_km int,
  updated_at timestamptz,
  followed_by_me boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_radius double precision := least(greatest(coalesce(p_radius_km, 25), 1), 100);
  v_lat double precision := round(p_lat::numeric, 2);
  v_lng double precision := round(p_lng::numeric, 2);
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.presence where presence.user_id = me and expires_at > now()) then
    raise exception 'Turn on nearby visibility to see travellers around you';
  end if;
  return query
  select pr.user_id, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles,
    pr.place_label, pr.status_text,
    greatest(1, round(public._km_between(v_lat, v_lng, pr.lat_coarse, pr.lng_coarse)))::int,
    pr.updated_at,
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = pr.user_id)
  from public.presence pr
  join public.profiles p on p.id = pr.user_id
  where pr.user_id <> me
    and pr.expires_at > now()
    and p.is_discoverable
    and not public._blocked_between(me, pr.user_id)
    and pr.lat_coarse between v_lat - v_radius / 111.0 and v_lat + v_radius / 111.0
    and public._km_between(v_lat, v_lng, pr.lat_coarse, pr.lng_coarse) <= v_radius
  order by 9 asc, pr.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- ===========================================================================
-- Trip matching: travellers heading to the same place around the same dates
-- ===========================================================================

create table if not exists public.trip_match_notices (
  trip_a uuid not null,
  trip_b uuid not null,
  created_at timestamptz not null default now(),
  primary key (trip_a, trip_b)
);

alter table public.trip_match_notices enable row level security;
revoke all on public.trip_match_notices from anon, authenticated;

create or replace function public._trip_overlap_days(
  a_start date, a_end date, b_start date, b_end date, p_slack int default 3
)
returns int
language sql
immutable
as $$
  select case
    when a_start is null or b_start is null then null
    when daterange(a_start - p_slack, coalesce(a_end, a_start) + p_slack, '[]')
         && daterange(b_start, coalesce(b_end, b_start), '[]')
      then greatest(0, least(coalesce(a_end, a_start), coalesce(b_end, b_start)) - greatest(a_start, b_start) + 1)
    else null
  end
$$;

create or replace function public.find_trip_matches(p_trip uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[],
  destination text,
  starts_on date,
  ends_on date,
  overlap_days int,
  followed_by_me boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_trip public.trips;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select * into v_trip from public.trips where id = p_trip and trips.user_id = me;
  if not found then
    raise exception 'Trip not found — sync it first';
  end if;
  -- Reciprocal: you only see others while your own trip is open to meet.
  if not v_trip.open_to_meet or v_trip.place_key is null or v_trip.starts_on is null then
    return;
  end if;
  return query
  select t.user_id, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles, t.destination,
    t.starts_on, t.ends_on,
    public._trip_overlap_days(v_trip.starts_on, v_trip.ends_on, t.starts_on, t.ends_on, 3),
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = t.user_id)
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.user_id <> me
    and t.open_to_meet
    and t.place_key = v_trip.place_key
    and t.status <> 'cancelled'
    and p.is_discoverable
    and coalesce(t.ends_on, t.starts_on) >= current_date
    and public._trip_overlap_days(v_trip.starts_on, v_trip.ends_on, t.starts_on, t.ends_on, 3) is not null
    and not public._blocked_between(me, t.user_id)
  order by 10 desc, p.followers_count desc
  limit 50;
end;
$$;

create or replace function public.travellers_heading_to(
  p_place_key text,
  p_from date default current_date,
  p_to date default current_date + 120,
  p_limit int default 30
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  starts_on date,
  ends_on date,
  followed_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (t.user_id)
    t.user_id, p.username, p.display_name, p.avatar_path, p.tier, t.starts_on, t.ends_on,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = t.user_id)
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where auth.uid() is not null
    and t.place_key = p_place_key
    and t.open_to_meet
    and t.status <> 'cancelled'
    and t.starts_on is not null
    and p.is_discoverable
    and daterange(t.starts_on, coalesce(t.ends_on, t.starts_on), '[]') && daterange(p_from, p_to, '[]')
    and not public._blocked_between(auth.uid(), t.user_id)
  order by t.user_id, t.starts_on
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- Notify both sides once when a trip newly matches another (network effect, rate-limited).
create or replace function public.on_trip_match_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not new.open_to_meet or new.place_key is null or new.starts_on is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.open_to_meet
     and old.place_key is not distinct from new.place_key
     and old.starts_on is not distinct from new.starts_on
     and old.ends_on is not distinct from new.ends_on then
    return new;
  end if;
  if coalesce(new.ends_on, new.starts_on) < current_date then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and is_discoverable) then
    return new;
  end if;
  for r in
    select t.id, t.user_id
    from public.trips t
    join public.profiles p on p.id = t.user_id
    where t.id <> new.id
      and t.user_id <> new.user_id
      and t.open_to_meet
      and t.place_key = new.place_key
      and t.status <> 'cancelled'
      and p.is_discoverable
      and coalesce(t.ends_on, t.starts_on) >= current_date
      and public._trip_overlap_days(new.starts_on, new.ends_on, t.starts_on, t.ends_on, 3) is not null
      and not exists (
        select 1 from public.trip_match_notices n
        where n.trip_a = least(t.id, new.id) and n.trip_b = greatest(t.id, new.id)
      )
    limit 25
  loop
    insert into public.trip_match_notices (trip_a, trip_b) values (least(r.id, new.id), greatest(r.id, new.id))
    on conflict do nothing;
    perform public._notify(r.user_id, new.user_id, 'trip_match', 'trip', r.id, coalesce(new.destination, new.place_key));
    perform public._notify(new.user_id, r.user_id, 'trip_match', 'trip', new.id, coalesce(new.destination, new.place_key));
  end loop;
  return new;
end;
$$;

drop trigger if exists trips_match_notify on public.trips;
create trigger trips_match_notify after insert or update of open_to_meet, place_key, starts_on, ends_on on public.trips
  for each row execute function public.on_trip_match_candidate();

-- ===========================================================================
-- Reports now also cover Connect content.
-- ===========================================================================

create or replace function public.on_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hide_at constant int := 3;
begin
  perform public._enforce_rate_limit('public.reports', 'reporter_id', new.reporter_id, interval '1 hour', 31, 'reports');
  case new.target_type
    when 'post' then
      update public.posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'comment' then
      update public.post_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'message' then
      update public.messages set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'tip' then
      update public.place_tips set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'board_post' then
      update public.board_posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'conversation' then
      update public.conversations set report_count = report_count + 1 where id = new.target_id;
    else
      null;
  end case;
  return new;
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.start_direct_conversation(uuid)',
    'public.create_group_conversation(text, uuid[], uuid)',
    'public.join_conversation_by_code(text)',
    'public.join_place_room(text, text)',
    'public.leave_conversation(uuid)',
    'public.remove_conversation_member(uuid, uuid)',
    'public.mark_conversation_read(uuid)',
    'public.my_conversations()',
    'public.conversation_members_list(uuid)',
    'public.conversation_messages(uuid, timestamptz, int)',
    'public.place_rooms(text, int)',
    'public.respond_board_request(uuid, boolean)',
    'public.board_page(text, text, boolean, timestamptz, int, uuid)',
    'public.board_requests_for_post(uuid)',
    'public.place_tips_page(text, int)',
    'public.nearby_travellers(double precision, double precision, double precision, int)',
    'public.find_trip_matches(uuid)',
    'public.travellers_heading_to(text, date, date, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array array[
    'public.on_message_before_insert()',
    'public.on_message_inserted()',
    'public.on_member_change()',
    'public.on_board_post_before_insert()',
    'public.on_board_request_before_insert()',
    'public.on_board_request_change()',
    'public.on_tip_before_insert()',
    'public.on_tip_vote_change()',
    'public.on_presence_write()',
    'public.on_trip_match_candidate()',
    'public.on_report_created()',
    'public._km_between(double precision, double precision, double precision, double precision)',
    'public._trip_overlap_days(date, date, date, date, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- Realtime chat.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ===== migrations/20261006030000_wayfare_safety_stats.sql =====
-- Wayfare safety + verification: live location links for trusted contacts,
-- GPS-verified traveller stats/tiers, and a richer read-only shared trip payload.

-- ===========================================================================
-- Live location sharing (anyone with the unguessable link can view until it expires)
-- ===========================================================================

create table if not exists public.live_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text check (label is null or char_length(label) <= 80),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy_m double precision,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '72 hours')
);

create index if not exists live_shares_user_idx on public.live_shares (user_id, created_at desc);

alter table public.live_shares enable row level security;

drop policy if exists live_shares_own on public.live_shares;
create policy live_shares_own on public.live_shares for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.on_live_share_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists live_shares_touch on public.live_shares;
create trigger live_shares_touch before insert or update on public.live_shares
  for each row execute function public.on_live_share_write();

-- Public viewer (web page / app). Returns null once the link is over a day past expiry.
create or replace function public.get_live_share(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'label', s.label,
    'display_name', coalesce(p.display_name, p.username, 'A Wayfare traveller'),
    'latitude', s.latitude,
    'longitude', s.longitude,
    'accuracy_m', s.accuracy_m,
    'updated_at', s.updated_at,
    'expires_at', s.expires_at,
    'active', s.expires_at > now()
  )
  from public.live_shares s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id and s.expires_at > now() - interval '1 day'
$$;

revoke all on function public.get_live_share(uuid) from public;
grant execute on function public.get_live_share(uuid) to anon, authenticated;
revoke all on function public.on_live_share_write() from public, anon, authenticated;

-- ===========================================================================
-- Verified stats + tiers (computed from GPS tracks, never from client input)
-- ===========================================================================

create or replace function public.compute_tier(p_km numeric, p_max_alt numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_km, 0) >= 500 or coalesce(p_max_alt, 0) >= 5500 then 'legendary'
    when coalesce(p_km, 0) >= 100 or coalesce(p_max_alt, 0) >= 4000 then 'hardcore'
    else 'traveler'
  end
$$;

grant execute on function public.compute_tier(numeric, numeric) to anon, authenticated;

create or replace function public.refresh_my_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_km numeric;
  v_alt numeric;
  v_trips int;
  v_tier text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select coalesce(sum(public.trip_route_km(t.id)), 0) into v_km from public.trips t where t.user_id = me;
  select coalesce(max(c.altitude_m), 0) into v_alt
  from public.trips t
  cross join lateral public._clean_track(t.id) c
  where t.user_id = me and c.altitude_m between -500 and 9000;
  select count(*) into v_trips from public.trips where user_id = me;
  v_tier := public.compute_tier(v_km, v_alt);
  update public.profiles
  set verified_km = v_km,
      max_altitude_m = round(v_alt, 1),
      trips_count = v_trips,
      tier = v_tier,
      stats_updated_at = now(),
      last_active_at = now()
  where id = me;
  return json_build_object('verified_km', v_km, 'max_altitude_m', round(v_alt, 1), 'trips_count', v_trips, 'tier', v_tier);
end;
$$;

revoke all on function public.refresh_my_stats() from public, anon;
grant execute on function public.refresh_my_stats() to authenticated;

-- ===========================================================================
-- Shared trip v2: explicit columns only (no user ids / private notes), author name,
-- verified route preview and stats for the web + in-app viewer.
-- ===========================================================================

create or replace function public.get_shared_trip(p_share_id text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_share_id is null or length(p_share_id) < 8 then
    return null;
  end if;
  select json_build_object(
    'trip', json_build_object(
      'title', t.title,
      'destination', t.destination,
      'trip_type', t.trip_type,
      'starts_on', t.starts_on,
      'ends_on', t.ends_on,
      'status', t.status,
      'notes', null
    ),
    'author', json_build_object(
      'display_name', coalesce(p.display_name, 'A Wayfare traveller'),
      'username', p.username,
      'tier', p.tier
    ),
    'stats', json_build_object(
      'route_km', public.trip_route_km(t.id),
      'entry_count', (select count(*) from public.entries e where e.trip_id = t.id)
    ),
    'route', public.trip_route_preview(t.id, 200),
    'entries', coalesce(
      (select json_agg(json_build_object(
          'recorded_at', e.recorded_at,
          'body', e.body,
          'mood', e.mood,
          'place_name', e.place_name,
          'weather', e.weather
        ) order by e.recorded_at asc)
       from public.entries e
       where e.trip_id = t.id),
      '[]'::json
    )
  )
  into result
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.share_id = p_share_id
    and t.visibility = 'link'
  limit 1;
  return result;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ===== migrations/20261116000000_live_share_expiry_privacy.sql =====
-- Expired/revoked public links may describe their ended state, but must not expose location.
-- Preserve the RPC signature, JSON keys, owner RLS and one-day ended-link response window.
create or replace function public.get_live_share(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'label', s.label,
    'display_name', coalesce(p.display_name, p.username, 'A Wayfare traveller'),
    'latitude', case when s.expires_at > now() then s.latitude else null end,
    'longitude', case when s.expires_at > now() then s.longitude else null end,
    'accuracy_m', case when s.expires_at > now() then s.accuracy_m else null end,
    'updated_at', s.updated_at,
    'expires_at', s.expires_at,
    'active', s.expires_at > now()
  )
  from public.live_shares s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id and s.expires_at > now() - interval '1 day'
$$;
revoke all on function public.get_live_share(uuid) from public;
grant execute on function public.get_live_share(uuid) to anon, authenticated;
