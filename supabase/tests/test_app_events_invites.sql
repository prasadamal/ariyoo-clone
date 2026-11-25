-- Usage counts / crash reports / feedback are write-only; invite links join a journey safely.
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
  ('ana@inv.test', '{"display_name":"Ana","username":"ana_i"}'),
  ('ben@inv.test', '{"display_name":"Ben","username":"ben_i"}'),
  ('cal@inv.test', '{"display_name":"Cal","username":"cal_i"}'),
  ('dee@inv.test', '{"display_name":"Dee","username":"dee_i"}');
insert into tests.users select email, id from auth.users where email like '%@inv.test';

-- ---------------------------------------------------------------------------
-- Usage counts, crash reports and feedback are write-only
-- ---------------------------------------------------------------------------
select tests.act_as('ana@inv.test');
insert into public.app_events (device_id, kind, name, app_version, platform) values ('device-ana-1', 'event', 'app_open', '2.0.0', 'android');
insert into public.app_events (device_id, kind, name, detail) values ('device-ana-1', 'error', 'TypeError', 'x is undefined');
insert into public.app_feedback (device_id, message) values ('device-ana-1', 'Love the diary');
select tests.expect_error($$select count(*) from public.app_events$$, 'permission denied');
select tests.expect_error($$select count(*) from public.app_feedback$$, 'permission denied');
select tests.expect_error($$insert into public.app_events (device_id, kind, name, user_id) values ('device-ana-1', 'event', 'x', gen_random_uuid())$$);
select tests.expect_error($$insert into public.app_events (device_id, kind, name) values ('device-ana-1', 'spam', 'x')$$);
select tests.expect_error($$select * from public.app_retention_weekly$$);
-- Signed out (anon) can report too, but never as someone else.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
insert into public.app_events (device_id, kind, name) values ('device-guest-1', 'event', 'app_open');
reset role;
select tests.check((select count(*) from public.app_events where device_id = 'device-ana-1') = 2 and (select count(*) from public.app_events where device_id = 'device-ana-1' and user_id is not null) = 0, 'signed-in events are stored without the account');
select tests.check((select count(*) from public.app_events where device_id = 'device-guest-1' and user_id is null) = 1, 'guest events have no user');
select tests.check((select new_devices from public.app_retention_weekly limit 1) >= 1, 'retention view works for the founder');

-- ---------------------------------------------------------------------------
-- Invite links
-- ---------------------------------------------------------------------------
select tests.act_as('ana@inv.test');
select tests.remember('trip', gen_random_uuid());
insert into public.trips (id, user_id, title) values (tests.id('trip'), auth.uid(), 'Goa with friends');
create temp table tok (t text);
grant all on tok to authenticated, anon;
insert into tok select public.create_trip_invite(tests.id('trip'));
select tests.check(char_length((select t from tok)) >= 16, 'owner gets an invite token');
select tests.check(public.create_trip_invite(tests.id('trip')) = (select t from tok), 'the live link is reused');
select tests.expect_error($$select count(*) from public.trip_invites$$, 'permission denied');

-- A stranger can't make links for someone else's journey.
select tests.act_as('cal@inv.test');
select tests.expect_error(format($$select public.create_trip_invite(%L)$$, tests.id('trip')), 'Only the owner or an admin');

-- Ben opens the link: sees what it is, joins as a member, joining twice is harmless.
select tests.act_as('ben@inv.test');
select tests.check((select title from public.preview_trip_invite((select t from tok))) = 'Goa with friends', 'preview shows the journey');
select tests.check((select invited_by from public.preview_trip_invite((select t from tok))) = 'Ana', 'preview shows who invited');
select tests.check(public.accept_trip_invite((select t from tok)) = tests.id('trip'), 'accept returns the journey');
select tests.check(public.trip_role(tests.id('trip')) = 'member', 'joined as a member');
select tests.check(public.accept_trip_invite((select t from tok)) = tests.id('trip'), 'accepting again is harmless');
select tests.expect_error(format($$select public.create_trip_invite(%L)$$, tests.id('trip')), 'Only the owner or an admin');

-- Owner accepting their own link changes nothing.
select tests.act_as('ana@inv.test');
select tests.check(public.accept_trip_invite((select t from tok)) = tests.id('trip'), 'owner accept is a no-op');
select tests.check((select count(*) from public.trip_members where trip_id = tests.id('trip')) = 1, 'only Ben was added');

-- Expired or used-up links stop working.
reset role;
update public.trip_invites set expires_at = now() - interval '1 minute' where token = (select t from tok);
select tests.act_as('cal@inv.test');
select tests.check((select count(*) from public.preview_trip_invite((select t from tok))) = 0, 'expired link previews nothing');
select tests.expect_error(format($$select public.accept_trip_invite(%L)$$, (select t from tok)), 'expired');
select tests.check(public.trip_role(tests.id('trip')) is null, 'expired link did not add Cal');
reset role;
update public.trip_invites set expires_at = now() + interval '1 day', uses_left = 0 where token = (select t from tok);
select tests.act_as('cal@inv.test');
select tests.expect_error(format($$select public.accept_trip_invite(%L)$$, (select t from tok)), 'expired');

-- Someone who blocked the inviter can't be pulled in through a link.
reset role;
update public.trip_invites set uses_left = 5 where token = (select t from tok);
select tests.act_as('dee@inv.test');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('ana@inv.test'));
select tests.expect_error(format($$select public.accept_trip_invite(%L)$$, (select t from tok)), 'expired');

-- Signed out: nothing.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.expect_error(format($$select public.accept_trip_invite(%L)$$, (select t from tok)));

-- Leave the shared database as we found it.
reset role;
delete from public.app_events where device_id in ('device-ana-1', 'device-guest-1');
delete from public.app_feedback where device_id = 'device-ana-1';
delete from auth.users where email like '%@inv.test';
\o
\pset tuples_only on
select 'app events, feedback and invite tests passed' as result;
