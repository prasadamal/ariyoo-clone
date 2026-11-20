-- The everyday journal (trip_type 'everyday') is a private notebook for ordinary days, stored as a
-- trip so it syncs like one. It is not a journey, so it must not inflate a traveller's trip count.
-- Same function as 20261006030000_wayfare_safety_stats.sql, with that one filter added.
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
  select count(*) into v_trips from public.trips where user_id = me and trip_type <> 'everyday';
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
