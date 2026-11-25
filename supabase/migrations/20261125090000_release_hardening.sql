-- Release hardening from the pre-launch review. Safe to run more than once.
-- Run after 20261124150000_trip_story_and_admin.sql.

-- =============================================================================================
-- 1. The older public reader returns exactly what a story link promises.
--    get_shared_trip (the original read-only link, still answering old links and the in-app
--    viewer) accepted the same link id as a story and returned the route, weather, username and
--    tier, and never excluded the everyday diary. It now returns the same fields as
--    get_trip_story: title, destination, type, dates, the author's first name, and each moment's
--    time, words, mood and typed place name. No route, coordinates, weather, money, companions,
--    username or tier; never the everyday diary. The shape stays compatible with old viewers
--    (route = [], stats.route_km = 0).
-- =============================================================================================
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
      'ends_on', t.ends_on
    ),
    'author', json_build_object(
      'display_name', coalesce(nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''), 'A Wayfare traveller')
    ),
    'stats', json_build_object(
      'route_km', 0,
      'entry_count', (select count(*) from public.entries e where e.trip_id = t.id)
    ),
    'route', '[]'::json,
    'entries', coalesce(
      (select json_agg(json_build_object(
          'recorded_at', e.recorded_at,
          'body', e.body,
          'mood', e.mood,
          'place_name', e.place_name
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
    and t.trip_type <> 'everyday'
  limit 1;
  return result;
end;
$$;
revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- =============================================================================================
-- 2. Usage counts and crash reports are not tied to accounts. The column used to default to the
--    signed-in user; it now stays empty, and rows already stored lose the link.
-- =============================================================================================
alter table public.app_events alter column user_id set default null;
update public.app_events set user_id = null where user_id is not null;

-- =============================================================================================
-- 3. Admins can turn off a story link someone reported (abuse, private data). The journey's
--    owner can share it again later; that makes a new link (the app mints a fresh id).
-- =============================================================================================
create or replace function public.admin_disable_story(p_share_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  perform public._require_admin();
  update public.trips
     set visibility = 'private', share_id = null, updated_at = now()
   where share_id = p_share_id
  returning title into v_title;
  if v_title is null then
    raise exception 'No story with that link' using errcode = 'P0002';
  end if;
  return v_title;
end;
$$;
revoke all on function public.admin_disable_story(text) from public, anon;
grant execute on function public.admin_disable_story(text) to authenticated;
