-- Security round 1: the audit's attacks (27 Nov 2026), re-run after the lockdown. Each must fail.
-- Runs on the local stub (see run_local.sh) as real API roles with RLS enforced.
-- Cast: Olivia owns the journey, Ed is an admin (like a group admin), Vic is a member (view only), Sam is a stranger.
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

-- Social was switched back on for test_social_connect.sql: re-apply the lockdown first.
\ir ../migrations/20261128090000_security_round1.sql
\o /dev/null

insert into auth.users (email, raw_user_meta_data) values
  ('owen@sec.test', '{"display_name":"Owen","username":"owen_s"}'),
  ('ada@sec.test', '{"display_name":"Ada","username":"ada_s"}'),
  ('sam@sec.test', '{"display_name":"Sam","username":"sam_s"}');
insert into tests.users select email, id from auth.users where email like '%@sec.test';
update public.profiles set is_discoverable = false where id = tests.uid('owen@sec.test');

-- Owen's private journey with one photo; Ada is a crew admin; Sam is a stranger.
select tests.act_as('owen@sec.test');
select tests.remember('trip', gen_random_uuid());
select tests.remember('entry', gen_random_uuid());
insert into public.trips (id, user_id, title) values (tests.id('trip'), auth.uid(), 'Hampi');
insert into public.entries (id, trip_id, user_id, recorded_at, body) values (tests.id('entry'), tests.id('trip'), auth.uid(), now(), 'Boulders');
insert into public.entry_media (trip_id, entry_id, user_id, storage_path, mime_type)
  values (tests.id('trip'), tests.id('entry'), auth.uid(), auth.uid() || '/' || tests.id('trip') || '/secret.jpg', 'image/jpeg');
select public.add_trip_member(tests.id('trip'), 'ada_s', 'admin');
reset role;
insert into storage.objects (bucket_id, name) values ('entry-media', tests.uid('owen@sec.test') || '/' || tests.id('trip') || '/secret.jpg');

-- SEC-01: Sam points a row in his own journey at Owen's photo, then tries to open it.
select tests.act_as('sam@sec.test');
select tests.remember('samtrip', gen_random_uuid());
select tests.remember('sament', gen_random_uuid());
insert into public.trips (id, user_id, title) values (tests.id('samtrip'), auth.uid(), 'Mine');
insert into public.entries (id, trip_id, user_id, recorded_at, body) values (tests.id('sament'), tests.id('samtrip'), auth.uid(), now(), 'x');
select tests.expect_error(format(
  $$insert into public.entry_media (trip_id, entry_id, user_id, storage_path, mime_type) values (%L, %L, %L, %L, 'image/jpeg')$$,
  tests.id('samtrip'), tests.id('sament'), auth.uid(), tests.uid('owen@sec.test') || '/' || tests.id('trip') || '/secret.jpg'), 'entry_media_path_in_own_folder');
select tests.check((select count(*) from storage.objects where bucket_id = 'entry-media') = 0, 'SEC-01: stranger cannot open the photo');
select tests.check(not public.is_story_photo(tests.uid('owen@sec.test') || '/' || tests.id('trip') || '/secret.jpg'), 'SEC-01: not a public story photo');

-- SEC-02: Ada (crew admin) tries to publish Owen's journey; her title edit still works.
select tests.act_as('ada@sec.test');
update public.trips set visibility = 'link', share_id = 'leak-0001', open_to_meet = true, title = 'Hampi 2026' where id = tests.id('trip');
reset role;
select tests.check((select visibility from public.trips where id = tests.id('trip')) <> 'link', 'SEC-02: admin cannot publish the journey');
select tests.check((select share_id from public.trips where id = tests.id('trip')) is null, 'SEC-02: admin cannot set a story link');
select tests.check((select title from public.trips where id = tests.id('trip')) = 'Hampi 2026', 'SEC-02: admin still edits the details');
select tests.act_as('owen@sec.test');
update public.trips set visibility = 'link', share_id = 'mine-0001' where id = tests.id('trip');
reset role;
select tests.check((select share_id from public.trips where id = tests.id('trip')) = 'mine-0001', 'SEC-02: the owner can share');

-- SEC-03: Sam can't read Owen's profile or list everyone; Ada (crew) can see Owen.
select tests.act_as('sam@sec.test');
select tests.check((select count(*) from public.profiles where id = tests.uid('owen@sec.test')) = 0, 'SEC-03: stranger cannot read a profile');
select tests.check((select count(*) from public.profiles) = 1, 'SEC-03: stranger sees only himself');
select tests.check((select username from public.find_traveller('owen_s')) = 'owen_s', 'exact username lookup still works for adding crew');
select tests.check(public.my_member_number() >= 1, 'member number still works');
select tests.act_as('ada@sec.test');
select tests.check((select count(*) from public.profiles where id = tests.uid('owen@sec.test')) = 1, 'crew can see each other');

-- Social off: nearby scan, travel-date lookup, group chats and posting are refused.
select tests.act_as('sam@sec.test');
select tests.expect_error($$select * from public.nearby_travellers(51.5, -0.1, 50, 50)$$, 'permission denied');
select tests.expect_error($$select * from public.travellers_heading_to('goa', current_date, current_date + 5, 50)$$, 'permission denied');
select tests.expect_error(format($$select public.create_group_conversation('x', array[%L]::uuid[], null)$$, tests.uid('owen@sec.test')), 'permission denied');
select tests.expect_error($$insert into public.posts (user_id, body) values (auth.uid(), 'hi')$$, 'row-level security');
select tests.expect_error($$insert into public.presence (user_id, lat_coarse, lng_coarse) values (auth.uid(), 12.9, 77.6)$$, 'row-level security');
reset role;

-- SEC-05: post photos are no longer public.
select tests.check(not (select public from storage.buckets where id = 'post-media'), 'SEC-05: post-media is private');

\o
select 'security round 1 tests passed (audit attacks blocked)' as result;
