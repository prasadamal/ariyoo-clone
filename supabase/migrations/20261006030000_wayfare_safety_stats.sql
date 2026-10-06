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
