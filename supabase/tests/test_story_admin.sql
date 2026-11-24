-- Trip stories show only what's safe to share; the admin console is for admins only.
\set ON_ERROR_STOP 1
\pset pager off
\o /dev/null
set client_min_messages = warning;

reset role;
drop schema if exists tests cascade;
create schema tests;

create table tests.users (email text primary key, id uuid not null);
create table tests.ids (name text primary key, id uuid not null);

create or replace function tests.uid(p_email text) returns uuid language sql stable as $$
  select id from tests.users where email = p_email
$$;

create or replace function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name
$$;

create or replace function tests.remember(p_name text, p_id uuid) returns uuid language sql as $$
  insert into tests.ids (name, id) values (p_name, p_id)
  on conflict (name) do update set id = excluded.id
  returning id
$$;

create or replace function tests.act_as(p_email text) returns uuid language plpgsql as $$
declare
  v uuid := tests.uid(p_email);
begin
  if v is null then
    raise exception 'unknown test user %', p_email;
  end if;
  perform set_config('request.jwt.claim.sub', v::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('role', 'authenticated', false);
  return v;
end;
$$;

create or replace function tests.check(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'FAILED: %', p_msg;
  end if;
end;
$$;

create or replace function tests.expect_error(p_sql text, p_like text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not ilike '%' || p_like || '%' then
      raise exception 'FAILED: expected error like "%" but got "%" for: %', p_like, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'FAILED: expected an error but statement succeeded: %', p_sql;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant select, insert, update on all tables in schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;


insert into auth.users (email, raw_user_meta_data) values
  ('ana@adm.test', '{"display_name":"Ana Rao","username":"ana_a"}'),
  ('ben@adm.test', '{"display_name":"Ben","username":"ben_a"}'),
  ('boss@adm.test', '{"display_name":"Boss","username":"boss_a"}');
insert into tests.users select email, id from auth.users where email like '%@adm.test';

-- ---------------------------------------------------------------------------
-- Trip story
-- ---------------------------------------------------------------------------
select tests.act_as('ana@adm.test');
select tests.remember('trip', gen_random_uuid());
select tests.remember('entry', gen_random_uuid());
insert into public.trips (id, user_id, title, destination, starts_on, ends_on) values (tests.id('trip'), auth.uid(), 'Munnar tea hills', 'Munnar', '2026-02-08', '2026-02-11');
insert into public.entries (id, trip_id, user_id, recorded_at, body, mood, place_name, latitude, longitude)
  values (tests.id('entry'), tests.id('trip'), auth.uid(), '2026-02-09T07:10:00Z', 'Chai on a wood stove', '😌 Calm', 'Top Station', 10.12, 77.24);
insert into public.entry_media (id, trip_id, entry_id, user_id, storage_path, mime_type) values
  (gen_random_uuid(), tests.id('trip'), tests.id('entry'), auth.uid(), 'u/' || tests.id('trip') || '/p1.jpg', 'image/jpeg'),
  (gen_random_uuid(), tests.id('trip'), tests.id('entry'), auth.uid(), 'u/' || tests.id('trip') || '/v1.m4a', 'audio/mp4');
insert into public.expenses (id, trip_id, user_id, amount, currency, category) values (gen_random_uuid(), tests.id('trip'), auth.uid(), 1200, 'INR', 'food');

-- Private journey: no story, no photos.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.check(public.get_trip_story('not-a-real-link') is null, 'unknown link: nothing');
select tests.check(not public.is_story_photo('u/' || tests.id('trip') || '/p1.jpg'), 'private journey photos stay private');
reset role;
update public.trips set share_id = 'story-link-0001', visibility = 'link' where id = tests.id('trip');

-- Story on: the moment and its photo, never money, GPS or voice notes.
set role anon;
create temp table story (j json);
grant all on story to anon, authenticated;
insert into story select public.get_trip_story('story-link-0001');
select tests.check((select j -> 'trip' ->> 'title' from story) = 'Munnar tea hills', 'story shows the journey');
select tests.check((select j ->> 'author' from story) = 'Ana', 'story shows only the first name');
select tests.check((select json_array_length(j -> 'moments') from story) = 1, 'story shows the moment');
select tests.check((select j -> 'moments' -> 0 ->> 'place_name' from story) = 'Top Station', 'typed place name is kept');
select tests.check((select json_array_length(j -> 'moments' -> 0 -> 'photos') from story) = 1, 'photos but not the voice note');
select tests.check((select j::text from story) not like '%10.12%' and (select j::text from story) not like '%1200%', 'no coordinates and no money');
select tests.check(public.is_story_photo('u/' || tests.id('trip') || '/p1.jpg'), 'story photo is readable');
select tests.check(not public.is_story_photo('u/' || tests.id('trip') || '/v1.m4a'), 'voice notes never are');
reset role;
-- The everyday journal is never a story, even with a link.
update public.trips set trip_type = 'everyday' where id = tests.id('trip');
set role anon;
select tests.check(public.get_trip_story('story-link-0001') is null, 'the diary is never shared as a story');
reset role;
update public.trips set trip_type = 'trek', visibility = 'private' where id = tests.id('trip');
set role anon;
select tests.check(public.get_trip_story('story-link-0001') is null, 'turning the link off hides the story');
select tests.check(not public.is_story_photo('u/' || tests.id('trip') || '/p1.jpg'), 'and its photos');

-- ---------------------------------------------------------------------------
-- Announcements are readable by everyone
-- ---------------------------------------------------------------------------
select tests.check((select count(*) from public.current_announcement()) = 0, 'no announcement yet');
select tests.expect_error($$select public.admin_overview()$$, 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- Admin console: admins only
-- ---------------------------------------------------------------------------
select tests.act_as('ben@adm.test');
select tests.check(not public.is_admin(), 'Ben is not an admin');
select tests.expect_error($$select public.admin_overview()$$, 'Admins only');
select tests.expect_error($$select * from public.admin_users_list()$$, 'Admins only');
select tests.expect_error($$select public.admin_announce('Hello', 'info', null)$$, 'Admins only');
select tests.expect_error(format($$select public.admin_set_suspended(%L, true)$$, tests.uid('ana@adm.test')), 'Admins only');
select tests.expect_error($$select count(*) from public.admin_users$$, 'permission denied');
select tests.expect_error($$insert into public.admin_users (user_id) values (auth.uid())$$, 'permission denied');
reset role;
insert into public.admin_users (user_id) values (tests.uid('boss@adm.test'));
insert into public.app_feedback (device_id, message, user_id) values ('device-ben-0001', 'Diary swipe is lovely', tests.uid('ben@adm.test'));
insert into public.app_events (device_id, kind, name, detail, app_version, platform) values
  ('device-ben-0001', 'event', 'app_open', null, '2.0.0', 'android'),
  ('device-ben-0001', 'error', 'TypeError', 'x is undefined', '2.0.0', 'android'),
  ('device-ben-0002', 'error', 'TypeError', 'y is undefined', '2.0.0', 'android');

select tests.act_as('boss@adm.test');
select tests.check(public.is_admin(), 'Boss is an admin');
select tests.check((public.admin_overview() ->> 'users_total')::int >= 3, 'overview counts users');
select tests.check((public.admin_overview() ->> 'feedback_open')::int >= 1, 'overview counts open feedback');
select tests.check(json_array_length(public.admin_overview() -> 'signups_by_day') = 30, '30 days of signups');
select tests.check((select count(*) from public.admin_users_list('ana_a')) = 1, 'user search finds Ana');
select tests.check((select email from public.admin_users_list('ana_a')) = 'ana@adm.test', 'admins see the email');
select tests.check((select occurrences from public.admin_errors(7) where name = 'TypeError') >= 2, 'crashes are grouped');
select tests.check((select devices from public.admin_errors(7) where name = 'TypeError') >= 2, 'and count devices');

-- Feedback inbox
create temp table fb (id bigint);
grant all on fb to authenticated, anon;
insert into fb select id from public.admin_feedback(true) where message = 'Diary swipe is lovely';
select public.admin_feedback_mark((select id from fb), true);
select tests.check(not exists (select 1 from public.admin_feedback(true) where id = (select id from fb)), 'handled feedback leaves the open list');
select tests.check(exists (select 1 from public.admin_feedback(false) where id = (select id from fb)), 'but stays in the full list');

-- Suspend: not admins, not yourself; it sets the sign-in ban and lifts it.
select public.admin_set_suspended(tests.uid('ben@adm.test'), true);
select tests.check((select suspended from public.admin_users_list('ben_a')), 'Ben is suspended');
select public.admin_set_suspended(tests.uid('ben@adm.test'), false);
select tests.check(not (select suspended from public.admin_users_list('ben_a')), 'and back');
select tests.expect_error(format($$select public.admin_set_suspended(%L, true)$$, tests.uid('boss@adm.test')), 'can''t be suspended');

-- Announcement: publish, everyone sees it, a new one replaces it, clear ends it.
select public.admin_announce('Sync is slow today, nothing is lost', 'warning', 2);
select public.admin_announce('All fixed, thanks for your patience', 'info', null);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.check((select message from public.current_announcement()) = 'All fixed, thanks for your patience', 'the newest announcement shows');
select tests.check((select count(*) from public.current_announcement()) = 1, 'only one at a time');
reset role;
select tests.act_as('boss@adm.test');
select public.admin_announce_clear();
select tests.check((select count(*) from public.current_announcement()) = 0, 'clear ends it');
select tests.expect_error($$select public.admin_report_set(gen_random_uuid(), 'deleted')$$, 'Unknown status');

reset role;
delete from public.app_announcements;
delete from public.app_events where device_id like 'device-ben-%';
delete from public.app_feedback where device_id = 'device-ben-0001';
delete from public.admin_users;
delete from auth.users where email like '%@adm.test';
\o
\pset tuples_only on
select 'story + admin tests passed' as result;
