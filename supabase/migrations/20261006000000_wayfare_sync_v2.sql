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
