-- Trip stories (a public link family can open) and the admin console. Safe to run more than once.
-- Run after 20261124090000_app_events_feedback_invites.sql (it adds a column to app_feedback).

-- =============================================================================================
-- 1. Trip story: what a story link shows. Moments, moods, typed place names and photos only:
--    no money, no GPS points or route, no companions, and never the everyday journal.
-- =============================================================================================
create or replace function public.get_trip_story(p_share_id text)
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
    'author', coalesce(nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''), 'A Wayfare traveller'),
    'moments', coalesce((
      select json_agg(json_build_object(
          'id', e.id,
          'recorded_at', e.recorded_at,
          'body', e.body,
          'mood', e.mood,
          'place_name', e.place_name,
          'photos', coalesce((
            select json_agg(m.storage_path order by m.created_at)
            from public.entry_media m
            where m.entry_id = e.id and m.storage_path is not null and coalesce(m.mime_type, '') not like 'audio%'
          ), '[]'::json)
        ) order by e.recorded_at asc)
      from public.entries e
      where e.trip_id = t.id
    ), '[]'::json)
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
revoke all on function public.get_trip_story(text) from public;
grant execute on function public.get_trip_story(text) to anon, authenticated;

-- A photo file is readable by anyone only while its journey's story link is on (not voice notes).
-- Security definer: the caller (often anon) can't read entry_media or trips itself.
create or replace function public.is_story_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entry_media m
    join public.trips t on t.id = m.trip_id
    where m.storage_path = p_name
      and t.visibility = 'link'
      and t.share_id is not null
      and t.trip_type <> 'everyday'
      and coalesce(m.mime_type, '') not like 'audio%'
  )
$$;
revoke all on function public.is_story_photo(text) from public;
grant execute on function public.is_story_photo(text) to anon, authenticated;

drop policy if exists entry_media_storage_select_story on storage.objects;
create policy entry_media_storage_select_story on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'entry-media' and public.is_story_photo(name));

-- =============================================================================================
-- 2. Admin console. Admins are listed here by hand (SQL editor); the app never adds one.
-- =============================================================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._require_admin() from public, anon, authenticated;

-- Feedback can be marked as handled.
alter table if exists public.app_feedback add column if not exists handled_at timestamptz;

-- Announcements: one short banner shown at the top of Journeys (everyone, guests too).
create table if not exists public.app_announcements (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) between 1 and 280),
  tone text not null default 'info' check (tone in ('info', 'warning')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
alter table public.app_announcements enable row level security;
revoke all on public.app_announcements from anon, authenticated;

create or replace function public.current_announcement()
returns table (id bigint, message text, tone text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.message, a.tone
  from public.app_announcements a
  where a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
  order by a.created_at desc
  limit 1
$$;
revoke all on function public.current_announcement() from public;
grant execute on function public.current_announcement() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin reads and actions. Each one checks is_admin() first.
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  perform public._require_admin();
  select json_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_new_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'journeys_total', (select count(*) from public.trips where trip_type <> 'everyday'),
    'journeys_new_7d', (select count(*) from public.trips where trip_type <> 'everyday' and created_at > now() - interval '7 days'),
    'moments_total', (select count(*) from public.entries),
    'moments_new_7d', (select count(*) from public.entries where created_at > now() - interval '7 days'),
    'photos_total', (select count(*) from public.entry_media where coalesce(mime_type, '') not like 'audio%'),
    'voice_total', (select count(*) from public.entry_media where coalesce(mime_type, '') like 'audio%'),
    'shared_journeys', (select count(*) from public.trips t where exists (select 1 from public.trip_members m where m.trip_id = t.id)),
    'story_links', (select count(*) from public.trips where visibility = 'link' and share_id is not null),
    'active_devices_1d', (select count(distinct device_id) from public.app_events where kind = 'event' and created_at > now() - interval '1 day'),
    'active_devices_7d', (select count(distinct device_id) from public.app_events where kind = 'event' and created_at > now() - interval '7 days'),
    'active_devices_30d', (select count(distinct device_id) from public.app_events where kind = 'event' and created_at > now() - interval '30 days'),
    'errors_7d', (select count(*) from public.app_events where kind = 'error' and created_at > now() - interval '7 days'),
    'feedback_open', (select count(*) from public.app_feedback where handled_at is null),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'invites_created', (select count(*) from public.trip_invites),
    'signups_by_day', (
      select coalesce(json_agg(json_build_object('day', d::date, 'count', (
        select count(*) from public.profiles p where p.created_at >= d and p.created_at < d + interval '1 day'
      )) order by d), '[]'::json)
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
    ),
    'active_by_day', (
      select coalesce(json_agg(json_build_object('day', d::date, 'count', (
        select count(distinct e.device_id) from public.app_events e
        where e.kind = 'event' and e.created_at >= d and e.created_at < d + interval '1 day'
      )) order by d), '[]'::json)
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
    ),
    'events_7d', (
      select coalesce(json_agg(json_build_object('name', x.name, 'count', x.n) order by x.n desc), '[]'::json)
      from (select name, count(*) n from public.app_events where kind = 'event' and created_at > now() - interval '7 days' group by name) x
    ),
    'retention', (
      select coalesce(json_agg(json_build_object('week', r.cohort_week, 'new', r.new_devices, 'back', r.active_in_week_2) order by r.cohort_week desc), '[]'::json)
      from (select * from public.app_retention_weekly limit 8) r
    ),
    'versions_7d', (
      select coalesce(json_agg(json_build_object('version', v.app_version, 'platform', v.platform, 'devices', v.n) order by v.n desc), '[]'::json)
      from (
        select coalesce(app_version, '?') app_version, coalesce(platform, '?') platform, count(distinct device_id) n
        from public.app_events where created_at > now() - interval '7 days' group by 1, 2
      ) v
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_users_list(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, username text, display_name text, email text, joined_at timestamptz, last_sign_in_at timestamptz,
  last_active_at timestamptz, journeys bigint, moments bigint, tier text, is_admin boolean, suspended boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return query
  select p.id, p.username, p.display_name, u.email::text, p.created_at, u.last_sign_in_at, p.last_active_at,
    (select count(*) from public.trips t where t.user_id = p.id and t.trip_type <> 'everyday'),
    (select count(*) from public.entries e where e.user_id = p.id),
    p.tier,
    exists (select 1 from public.admin_users a where a.user_id = p.id),
    coalesce(u.banned_until > now(), false)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p_search is null or p_search = ''
     or p.username ilike '%' || p_search || '%'
     or p.display_name ilike '%' || p_search || '%'
     or u.email ilike '%' || p_search || '%'
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Suspending signs the person out at their next token refresh and blocks new sign-ins
-- (Supabase checks auth.users.banned_until). Admins can't suspend themselves or each other.
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  if p_user = auth.uid() or exists (select 1 from public.admin_users a where a.user_id = p_user) then
    raise exception 'Admins can''t be suspended here' using errcode = '42501';
  end if;
  update auth.users set banned_until = case when p_suspended then 'infinity'::timestamptz else null end where id = p_user;
  if not found then
    raise exception 'No such user' using errcode = 'P0002';
  end if;
end;
$$;

-- Crash reports grouped by what went wrong.
create or replace function public.admin_errors(p_days int default 7)
returns table (name text, sample text, occurrences bigint, devices bigint, last_seen timestamptz, versions text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return query
  select e.name,
    (array_agg(e.detail order by e.created_at desc))[1],
    count(*),
    count(distinct e.device_id),
    max(e.created_at),
    string_agg(distinct coalesce(e.app_version, '?') || ' ' || coalesce(e.platform, ''), ', ')
  from public.app_events e
  where e.kind = 'error' and e.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
  group by e.name
  order by max(e.created_at) desc
  limit 100;
end;
$$;

create or replace function public.admin_feedback(p_open_only boolean default true)
returns table (id bigint, created_at timestamptz, message text, contact text, username text, app_version text, platform text, handled_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return query
  select f.id, f.created_at, f.message, f.contact, p.username, f.app_version, f.platform, f.handled_at
  from public.app_feedback f
  left join public.profiles p on p.id = f.user_id
  where not coalesce(p_open_only, true) or f.handled_at is null
  order by f.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_feedback_mark(p_id bigint, p_handled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  update public.app_feedback set handled_at = case when p_handled then now() else null end where id = p_id;
end;
$$;

create or replace function public.admin_reports(p_status text default 'open')
returns table (id uuid, created_at timestamptz, reporter text, target_type text, target_id uuid, reason text, details text, status text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return query
  select r.id, r.created_at, p.username, r.target_type, r.target_id, r.reason, r.details, r.status
  from public.reports r
  left join public.profiles p on p.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_report_set(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  if p_status not in ('open', 'reviewed', 'actioned', 'dismissed') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.reports set status = p_status where id = p_id;
end;
$$;

-- Publishing a new announcement replaces the current one; clearing ends it now.
create or replace function public.admin_announce(p_message text, p_tone text default 'info', p_days int default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  perform public._require_admin();
  update public.app_announcements set ends_at = now() where ends_at is null or ends_at > now();
  insert into public.app_announcements (message, tone, ends_at, created_by)
  values (trim(p_message), coalesce(p_tone, 'info'), case when p_days is null then null else now() + make_interval(days => p_days) end, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_announce_clear()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  update public.app_announcements set ends_at = now() where ends_at is null or ends_at > now();
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_overview()', 'admin_users_list(text, int, int)', 'admin_set_suspended(uuid, boolean)', 'admin_errors(int)',
    'admin_feedback(boolean)', 'admin_feedback_mark(bigint, boolean)', 'admin_reports(text)', 'admin_report_set(uuid, text)',
    'admin_announce(text, text, int)', 'admin_announce_clear()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
