-- Behavioural tests for shared journeys (trip_members, trip_role and the RLS that uses them).
-- Runs on the local stub (see run_local.sh) as real API roles with RLS enforced.
-- Cast: Olivia owns the journey, Ed "can add", Vic is "view only", Sam is a stranger.
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
  ('olivia@share.test', '{"display_name":"Olivia","username":"olivia_t"}'),
  ('ed@share.test', '{"display_name":"Ed","username":"ed_t"}'),
  ('vic@share.test', '{"display_name":"Vic","username":"vic_t"}'),
  ('sam@share.test', '{"display_name":"Sam","username":"sam_t"}');
insert into tests.users select email, id from auth.users where email like '%@share.test';

-- ---------------------------------------------------------------------------
-- Olivia's journey, with one of everything
-- ---------------------------------------------------------------------------
select tests.act_as('olivia@share.test');
select tests.remember('trip', gen_random_uuid());
select tests.remember('entry', gen_random_uuid());
select tests.remember('media', gen_random_uuid());
insert into public.trips (id, user_id, title) values (tests.id('trip'), auth.uid(), 'Spiti loop');
insert into public.entries (id, trip_id, user_id, recorded_at, body)
  values (tests.id('entry'), tests.id('trip'), auth.uid(), now(), 'Crossed Kunzum la');
insert into public.expenses (trip_id, user_id, category, amount) values (tests.id('trip'), auth.uid(), 'food', 450);
insert into public.itinerary_items (trip_id, user_id, day_index, title) values (tests.id('trip'), auth.uid(), 0, 'Chandratal');
insert into public.packing_items (trip_id, user_id, label) values (tests.id('trip'), auth.uid(), 'Down jacket');
insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude)
  values (tests.id('trip'), auth.uid(), now(), 32.2, 77.6);
insert into storage.objects (bucket_id, name)
  values ('entry-media', auth.uid() || '/' || tests.id('trip') || '/' || tests.id('media') || '.jpg');
insert into public.entry_media (id, trip_id, entry_id, user_id, storage_path, mime_type)
  values (tests.id('media'), tests.id('trip'), tests.id('entry'), auth.uid(),
          auth.uid() || '/' || tests.id('trip') || '/' || tests.id('media') || '.jpg', 'image/jpeg');
select tests.check(public.trip_role(tests.id('trip')) = 'owner', 'owner role');
select tests.check((select count(*) from public.my_trip_shares()) = 0, 'unshared journey is not listed as shared');

-- ---------------------------------------------------------------------------
-- A stranger sees nothing and cannot write into the journey (the old gap)
-- ---------------------------------------------------------------------------
select tests.act_as('sam@share.test');
select tests.check(public.trip_role(tests.id('trip')) is null, 'stranger has no role');
select tests.check((select count(*) from public.trips where id = tests.id('trip')) = 0, 'stranger cannot see journey');
select tests.check((select count(*) from public.entries where trip_id = tests.id('trip')) = 0, 'stranger cannot see moments');
select tests.check((select count(*) from storage.objects where bucket_id = 'entry-media') = 0, 'stranger cannot see photos');
select tests.expect_error(format(
  $$insert into public.entries (trip_id, user_id, recorded_at, body) values (%L, %L, now(), 'spam')$$,
  tests.id('trip'), auth.uid()), 'row-level security');
select tests.expect_error(format(
  $$insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude) values (%L, %L, now(), 1, 1)$$,
  tests.id('trip'), auth.uid()), 'row-level security');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'sam_t', 'editor')$$, tests.id('trip')), 'Only the person');
select tests.check((select count(*) from public.trip_people(tests.id('trip'))) = 0, 'stranger cannot list people');
-- Sam blocks Olivia: she can no longer find him.
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('olivia@share.test'));

-- ---------------------------------------------------------------------------
-- Olivia adds people
-- ---------------------------------------------------------------------------
select tests.act_as('olivia@share.test');
select tests.check((select username from public.add_trip_member(tests.id('trip'), '@Ed_T ', 'editor')) = 'ed_t', 'add editor by @Username');
select tests.check((select role from public.add_trip_member(tests.id('trip'), 'vic_t', 'viewer')) = 'viewer', 'add viewer');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'nobody_here', 'viewer')$$, tests.id('trip')), 'No traveller');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'sam_t', 'viewer')$$, tests.id('trip')), 'No traveller');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'olivia_t', 'viewer')$$, tests.id('trip')), 'your own');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'ed_t', 'admin')$$, tests.id('trip')), 'can add');
select tests.expect_error(format(
  $$insert into public.trip_members (trip_id, user_id, role) values (%L, %L, 'editor')$$,
  tests.id('trip'), tests.uid('sam@share.test')), 'permission denied');
select tests.check((select people from public.my_trip_shares() where trip_id = tests.id('trip') and role = 'owner') = 3, 'owner sees journey as shared with 3 people');
select tests.check((select string_agg(role, ',') from public.trip_people(tests.id('trip'))) = 'owner,editor,viewer', 'people listed owner first');

-- ---------------------------------------------------------------------------
-- Ed can add his own things, and nothing else
-- ---------------------------------------------------------------------------
select tests.act_as('ed@share.test');
select tests.check(public.trip_role(tests.id('trip')) = 'editor', 'editor role');
select tests.check((select count(*) from public.trips where id = tests.id('trip')) = 1, 'editor sees journey');
select tests.check((select count(*) from public.entries where trip_id = tests.id('trip')) = 1, 'editor sees moments');
select tests.check((select count(*) from public.expenses where trip_id = tests.id('trip')) = 1, 'editor sees expenses');
select tests.check((select count(*) from public.itinerary_items where trip_id = tests.id('trip')) = 1, 'editor sees plan');
select tests.check((select count(*) from public.entry_media where trip_id = tests.id('trip')) = 1, 'editor sees photo rows');
select tests.check((select count(*) from storage.objects where bucket_id = 'entry-media') = 1, 'editor can open the photo file');
select tests.check((select count(*) from public.packing_items where trip_id = tests.id('trip')) = 0, 'packing list stays personal');
select tests.check((select count(*) from public.track_points where trip_id = tests.id('trip')) = 0, 'route stays personal');
select tests.check((select owner_username from public.my_trip_shares() where trip_id = tests.id('trip')) = 'olivia_t', 'member sees who shared it');
select tests.remember('ed_entry', gen_random_uuid());
insert into public.entries (id, trip_id, user_id, recorded_at, body)
  values (tests.id('ed_entry'), tests.id('trip'), auth.uid(), now(), 'Momos at Kaza');
insert into public.expenses (trip_id, user_id, category, amount) values (tests.id('trip'), auth.uid(), 'food', 200);
insert into public.packing_items (trip_id, user_id, label) values (tests.id('trip'), auth.uid(), 'Ed''s gloves');
insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude)
  values (tests.id('trip'), auth.uid(), now(), 32.3, 78.0);
select tests.expect_error(format(
  $$insert into public.entries (trip_id, user_id, recorded_at, body) values (%L, %L, now(), 'as olivia')$$,
  tests.id('trip'), tests.uid('olivia@share.test')), 'row-level security');
update public.entries set body = 'edited by ed' where id = tests.id('entry');
delete from public.entries where id = tests.id('entry');
update public.trips set title = 'renamed by ed' where id = tests.id('trip');
delete from public.trip_members where user_id = tests.uid('vic@share.test');
select tests.expect_error(format($$select * from public.add_trip_member(%L, 'sam_t', 'viewer')$$, tests.id('trip')), 'Only the person');

reset role;
select tests.check((select body from public.entries where id = tests.id('entry')) = 'Crossed Kunzum la', 'editor cannot edit or delete the owner''s moment');
select tests.check((select title from public.trips where id = tests.id('trip')) = 'Spiti loop', 'editor cannot edit the journey');
select tests.check((select count(*) from public.trip_members where trip_id = tests.id('trip')) = 2, 'editor cannot remove people');

-- ---------------------------------------------------------------------------
-- Vic can look, and keep a personal packing list
-- ---------------------------------------------------------------------------
select tests.act_as('vic@share.test');
select tests.check(public.trip_role(tests.id('trip')) = 'viewer', 'viewer role');
select tests.check((select count(*) from public.entries where trip_id = tests.id('trip')) = 2, 'viewer sees everyone''s moments');
select tests.check((select count(*) from public.expenses where trip_id = tests.id('trip')) = 2, 'viewer sees everyone''s expenses');
select tests.expect_error(format(
  $$insert into public.entries (trip_id, user_id, recorded_at, body) values (%L, %L, now(), 'hi')$$,
  tests.id('trip'), auth.uid()), 'row-level security');
select tests.expect_error(format(
  $$insert into public.expenses (trip_id, user_id, category, amount) values (%L, %L, 'food', 1)$$,
  tests.id('trip'), auth.uid()), 'row-level security');
select tests.expect_error(format(
  $$insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude) values (%L, %L, now(), 1, 1)$$,
  tests.id('trip'), auth.uid()), 'row-level security');
insert into public.packing_items (trip_id, user_id, label) values (tests.id('trip'), auth.uid(), 'Vic''s sunscreen');
select tests.check((select count(*) from public.packing_items where trip_id = tests.id('trip')) = 1, 'viewer sees only their own packing item');

-- ---------------------------------------------------------------------------
-- Olivia: sees Ed's moment, cannot edit it, can remove it; changes access
-- ---------------------------------------------------------------------------
select tests.act_as('olivia@share.test');
select tests.check((select count(*) from public.entries where trip_id = tests.id('trip')) = 2, 'owner sees member moments');
select tests.check((select count(*) from public.packing_items where trip_id = tests.id('trip')) = 1, 'owner sees only her own packing item');
update public.entries set body = 'edited by olivia' where id = tests.id('ed_entry');
select tests.check((select body from public.entries where id = tests.id('ed_entry')) = 'Momos at Kaza', 'owner cannot rewrite a member''s words');
delete from public.entries where id = tests.id('ed_entry');
select tests.check((select count(*) from public.entries where id = tests.id('ed_entry')) = 0, 'owner can remove a member''s moment');
select tests.check((select role from public.add_trip_member(tests.id('trip'), 'vic_t', 'editor')) = 'editor', 'owner upgrades access');
select tests.check((select count(*) from public.trip_members where trip_id = tests.id('trip')) = 2, 'changing access does not duplicate');

-- ---------------------------------------------------------------------------
-- Leaving and being removed
-- ---------------------------------------------------------------------------
select tests.act_as('ed@share.test');
select tests.remember('ed_entry2', gen_random_uuid());
insert into public.entries (id, trip_id, user_id, recorded_at, body)
  values (tests.id('ed_entry2'), tests.id('trip'), auth.uid(), now(), 'Last night in Kaza');
delete from public.trip_members where trip_id = tests.id('trip') and user_id = auth.uid();
select tests.check(public.trip_role(tests.id('trip')) is null, 'left: no role');
select tests.check((select count(*) from public.trips where id = tests.id('trip')) = 0, 'left: journey gone');
select tests.check((select count(*) from public.entries where trip_id = tests.id('trip')) = 0, 'left: moments gone, own included');
select tests.check((select count(*) from public.track_points where trip_id = tests.id('trip')) = 0, 'left: own route in it gone too');
select tests.expect_error(format(
  $$insert into public.entries (trip_id, user_id, recorded_at, body) values (%L, %L, now(), 'back')$$,
  tests.id('trip'), auth.uid()), 'row-level security');

select tests.act_as('olivia@share.test');
select tests.check((select count(*) from public.entries where id = tests.id('ed_entry2')) = 1, 'what a leaver added stays with the journey');
delete from public.trip_members where trip_id = tests.id('trip') and user_id = tests.uid('vic@share.test');
select tests.check((select count(*) from public.my_trip_shares()) = 0, 'nobody left: no longer shared');

select tests.act_as('vic@share.test');
select tests.check((select count(*) from public.trips where id = tests.id('trip')) = 0, 'removed: journey gone');
select tests.check((select count(*) from storage.objects where bucket_id = 'entry-media') = 0, 'removed: photo files gone');

-- ---------------------------------------------------------------------------
-- Deleting the journey removes the sharing too
-- ---------------------------------------------------------------------------
select tests.act_as('olivia@share.test');
select * from public.add_trip_member(tests.id('trip'), 'vic_t', 'viewer');
delete from public.trips where id = tests.id('trip');
reset role;
select tests.check((select count(*) from public.trip_members where trip_id = tests.id('trip')) = 0, 'members removed with the journey');

-- Leave the shared database as we found it.
delete from auth.users where email like '%@share.test';
delete from storage.objects where bucket_id = 'entry-media' and name like '%' || tests.id('media') || '%';

reset role;
\o
\pset tuples_only on
select 'shared journey tests passed (' || (select count(*) from tests.ids) || ' fixtures)' as result;
