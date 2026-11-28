-- Behavioural tests for the Wayfare social + connect backend. Runs on the local stub
-- (see run_local.sh): every check executes as a real API role with RLS enforced.
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

create or replace function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  perform set_config('role', 'anon', false);
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

-- Social is switched off on the server until launch (20261128090000_security_round1.sql). These
-- tests check the social logic as it will run at launch, so switch it back on in this test database.
-- test_zz_security_round1.sql re-applies the lockdown afterwards and checks it holds.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'board_page', 'board_requests_for_post', 'respond_board_request', 'conversation_members_list',
             'conversation_messages', 'create_group_conversation', 'join_conversation_by_code', 'join_place_room',
             'leave_conversation', 'mark_conversation_read', 'my_conversations', 'remove_conversation_member',
             'start_direct_conversation', 'feed_page', 'post_comments_page', 'list_follows', 'get_profile',
             'search_travellers', 'suggested_travellers', 'notifications_page', 'place_rooms', 'place_tips_page',
             'nearby_travellers', 'travellers_heading_to', 'find_trip_matches')
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comments', 'post_likes', 'follows', 'messages', 'board_posts',
                           'board_requests', 'place_tips', 'place_tip_votes', 'presence'] loop
    execute format('drop policy if exists social_off_insert on public.%I', t);
    execute format('drop policy if exists social_off_update on public.%I', t);
  end loop;
end $$;
drop policy if exists profiles_select_own_or_crew on public.profiles;
create policy profiles_select_visible on public.profiles
  for select to authenticated using (id = auth.uid() or not public.blocked_with_me(id));

-- ---------------------------------------------------------------------------
-- Users + profiles
-- ---------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('alice@example.com', '{"display_name":"Alice","username":"alice"}'),
  ('bob@example.com', '{"display_name":"Bob"}'),
  ('carol@example.com', '{"display_name":"Carol"}'),
  ('dave@example.com', '{"display_name":"Dave"}'),
  ('eve@example.com', '{"display_name":"Eve","username":"alice"}'),
  ('frank@example.com', '{"display_name":"Frank"}');

insert into tests.users select email, id from auth.users;

select tests.check((select count(*) from public.profiles) = 6, 'every signup gets a profile');
select tests.check((select username from public.profiles where id = tests.uid('alice@example.com')) = 'alice', 'requested username kept');
select tests.check((select username from public.profiles where id = tests.uid('bob@example.com')) = 'bob', 'username seeded from email');
select tests.check((select username from public.profiles where id = tests.uid('eve@example.com')) like 'alice\_%', 'taken username gets a suffix');
select tests.check((select count(distinct username) from public.profiles) = 6, 'usernames unique');

select tests.act_as_anon();
select tests.check((select count(*) from public.profiles) = 0, 'anon cannot list profiles');
select tests.check(public.username_available('newname') and not public.username_available('alice'), 'username availability');
select tests.check(not public.username_available('Bad Name'), 'username format enforced');
select tests.expect_error($$select * from public.feed_page('discover')$$, 'permission denied');

select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.profiles) = 6, 'authenticated travellers see each other');
update public.profiles set bio = 'Chasing sunrises', travel_styles = '{trekker,photographer}' where id = auth.uid();
select tests.check((select bio from public.profiles where id = auth.uid()) = 'Chasing sunrises', 'edit own profile');
select tests.expect_error($$update public.profiles set tier = 'legendary' where id = auth.uid()$$, 'permission denied');
select tests.expect_error($$update public.profiles set verified_km = 9999 where id = auth.uid()$$, 'permission denied');
update public.profiles set bio = 'hacked' where id = tests.uid('bob@example.com');
reset role;
select tests.check((select bio from public.profiles where id = tests.uid('bob@example.com')) is null, 'cannot edit others');

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
insert into public.follows (follower_id, followee_id) values (auth.uid(), tests.uid('bob@example.com'));
insert into public.follows (follower_id, followee_id) values (auth.uid(), tests.uid('carol@example.com'));
select tests.expect_error(format('insert into public.follows (follower_id, followee_id) values (%L, %L)',
  tests.uid('carol@example.com'), tests.uid('bob@example.com')), 'row-level security');
select tests.expect_error(format('insert into public.follows (follower_id, followee_id) values (%L, %L)',
  auth.uid(), auth.uid()), 'check');
select tests.act_as('dave@example.com');
insert into public.follows (follower_id, followee_id) values (auth.uid(), tests.uid('bob@example.com'));
reset role;
select tests.check((select followers_count from public.profiles where id = tests.uid('bob@example.com')) = 2, 'followers counter');
select tests.check((select following_count from public.profiles where id = tests.uid('alice@example.com')) = 2, 'following counter');
select tests.check((select count(*) from public.notifications where user_id = tests.uid('bob@example.com') and kind = 'follow') = 2, 'follow notifications');

-- ---------------------------------------------------------------------------
-- Posts, visibility, likes, comments
-- ---------------------------------------------------------------------------
select tests.act_as('bob@example.com');
with ins as (insert into public.posts (user_id, body, place_name, place_key, like_count)
  values (auth.uid(), 'Sunrise at Kedarkantha summit!', 'Kedarkantha', 'kedarkantha', 999) returning id)
select tests.remember('bob_public', id) from ins;
with ins as (insert into public.posts (user_id, body, visibility)
  values (auth.uid(), 'Followers only: secret campsite', 'followers') returning id)
select tests.remember('bob_private', id) from ins;
select tests.check((select like_count from public.posts where id = tests.id('bob_public')) = 0, 'client cannot forge like counts');
select tests.expect_error(format('update public.posts set like_count = 5 where id = %L', tests.id('bob_public')), 'permission denied');
update public.posts set body = 'Sunrise at Kedarkantha summit! 🏔' where id = tests.id('bob_public');

select tests.act_as('carol@example.com');
with ins as (insert into public.posts (user_id, body, place_key)
  values (auth.uid(), 'Maggi at 12,000 ft', 'kedarkantha') returning id)
select tests.remember('carol_public', id) from ins;
select tests.expect_error($$insert into public.posts (user_id, body) values (auth.uid(), '   ')$$, 'check');

select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.feed_page('following')) = 3, 'following feed: bob x2 + carol');
select tests.check((select count(*) from public.feed_page('discover')) = 2, 'discover feed: public posts only');
select tests.check((select count(*) from public.feed_page('place', 'kedarkantha')) = 2, 'place feed');
select tests.check((select count(*) from public.feed_page('user', null, tests.uid('bob@example.com'))) = 2, 'profile feed for follower');
select tests.check((select body from public.feed_page('post', p_post => tests.id('bob_private'))) like 'Followers only%', 'single post read model');

select tests.act_as('frank@example.com');
select tests.check((select count(*) from public.posts where user_id = tests.uid('bob@example.com')) = 1, 'non-follower sees public only');
select tests.check((select count(*) from public.feed_page('post', p_post => tests.id('bob_private'))) = 0, 'single post respects visibility');
select tests.expect_error(format('insert into public.post_likes (post_id, user_id) values (%L, auth.uid())', tests.id('bob_private')), 'row-level security');

select tests.act_as('alice@example.com');
insert into public.post_likes (post_id, user_id) values (tests.id('bob_public'), auth.uid());
insert into public.post_comments (post_id, user_id, body) values (tests.id('bob_public'), auth.uid(), '  Stunning view!  ');
select tests.check((select liked_by_me from public.feed_page('discover') where id = tests.id('bob_public')), 'liked_by_me flag');
select tests.check((select comment_count from public.posts where id = tests.id('bob_public')) = 1, 'comment counter');
select tests.check((select body from public.post_comments_page(tests.id('bob_public')) limit 1) = 'Stunning view!', 'comment trimmed + listed');
select tests.expect_error(format('insert into public.post_likes (post_id, user_id) values (%L, %L)',
  tests.id('bob_public'), tests.uid('dave@example.com')), 'row-level security');

reset role;
select tests.check((select like_count from public.posts where id = tests.id('bob_public')) = 1, 'like counter');
select tests.check((select count(*) from public.notifications where user_id = tests.uid('bob@example.com') and kind in ('like', 'comment')) = 2, 'like + comment notifications');

-- Post owners can moderate comments on their posts.
select tests.act_as('bob@example.com');
delete from public.post_comments where post_id = tests.id('bob_public');
select tests.check((select comment_count from public.posts where id = tests.id('bob_public')) = 0, 'owner removed comment');

-- Linking someone else's trip is rejected.
select tests.act_as('carol@example.com');
with ins as (insert into public.trips (user_id, title, place_key) values (auth.uid(), 'Carol trip', 'kedarkantha') returning id)
select tests.remember('carol_trip', id) from ins;
select tests.act_as('dave@example.com');
select tests.expect_error(format('insert into public.posts (user_id, body, trip_id) values (auth.uid(), %L, %L)', 'mine?', tests.id('carol_trip')), 'own trips');

-- ---------------------------------------------------------------------------
-- Notifications are private and server-written
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.notifications_page()) = 0, 'alice has no notifications yet');
select tests.check((select count(*) from public.notifications where user_id = tests.uid('bob@example.com')) = 0, 'cannot read others notifications');
select tests.expect_error(format('insert into public.notifications (user_id, kind) values (%L, %L)', tests.uid('bob@example.com'), 'system'), 'permission denied');
select tests.act_as('bob@example.com');
select tests.check((select count(*) from public.notifications_page()) = 4, 'bob notification feed');
select tests.check((select actor_username from public.notifications_page() where kind = 'like') = 'alice', 'notification actor joined');
select public.mark_notifications_read();
select tests.check((select count(*) from public.notifications where read_at is null) = 0, 'mark all read');
select tests.expect_error($$update public.notifications set body = 'x'$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Blocks hide everything both ways and drop follows
-- ---------------------------------------------------------------------------
select tests.act_as('carol@example.com');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('alice@example.com'));
reset role;
select tests.check(not exists (select 1 from public.follows where follower_id = tests.uid('alice@example.com') and followee_id = tests.uid('carol@example.com')), 'block removed follow');
select tests.check((select following_count from public.profiles where id = tests.uid('alice@example.com')) = 1, 'counter after block');

select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.feed_page('discover') where user_id = tests.uid('carol@example.com')) = 0, 'blocked author hidden from feed');
select tests.check((select count(*) from public.get_profile(tests.uid('carol@example.com'))) = 0, 'blocked profile hidden');
select tests.check((select count(*) from public.search_travellers('carol')) = 0, 'blocked hidden from search');
select tests.expect_error(format('insert into public.follows (follower_id, followee_id) values (auth.uid(), %L)', tests.uid('carol@example.com')), 'row-level security');
select tests.check((select count(*) from public.blocks) = 0, 'cannot see who blocked you');
select tests.act_as('carol@example.com');
select tests.check((select count(*) from public.feed_page('user', null, tests.uid('alice@example.com'))) = 0, 'blocker does not see blocked either');
select tests.check((select username from public.my_blocked_profiles()) = 'alice', 'blocker can list who they blocked');
select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.my_blocked_profiles()) = 0, 'blocked user cannot see the block list');

-- ---------------------------------------------------------------------------
-- Reports auto-hide after three distinct reporters
-- ---------------------------------------------------------------------------
select tests.act_as('bob@example.com');
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', tests.id('carol_public'), 'spam');
select tests.expect_error(format('insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), %L, %L, %L)', 'post', tests.id('carol_public'), 'spam'), 'duplicate');
select tests.act_as('dave@example.com');
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', tests.id('carol_public'), 'scam');
select tests.check((select count(*) from public.posts where id = tests.id('carol_public')) = 1, 'visible after two reports');
select tests.act_as('frank@example.com');
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', tests.id('carol_public'), 'harassment');
select tests.check((select count(*) from public.posts where id = tests.id('carol_public')) = 0, 'hidden after three reports');
select tests.act_as('carol@example.com');
select tests.check((select count(*) from public.posts where id = tests.id('carol_public')) = 1, 'author still sees own hidden post');

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
select tests.remember('dm_ab', public.start_direct_conversation(tests.uid('bob@example.com')));
select tests.check(public.start_direct_conversation(tests.uid('bob@example.com')) = tests.id('dm_ab'), 'direct chat is reused');
insert into public.messages (conversation_id, sender_id, body) values (tests.id('dm_ab'), auth.uid(), 'Hey Bob! Heading to Kedarkantha too?');
select tests.expect_error(format('insert into public.messages (conversation_id, sender_id, kind, body) values (%L, auth.uid(), %L, %L)', tests.id('dm_ab'), 'system', 'fake'), 'row-level security');
select tests.expect_error(format('select public.start_direct_conversation(%L)', tests.uid('carol@example.com')), 'cannot message');

select tests.act_as('bob@example.com');
select tests.check((select unread_count from public.my_conversations() where id = tests.id('dm_ab')) = 1, 'unread count');
select tests.check((select other_username from public.my_conversations() where id = tests.id('dm_ab')) = 'alice', 'dm partner resolved');
select tests.check((select count(*) from public.conversation_messages(tests.id('dm_ab'))) = 1, 'bob reads the dm');
select public.mark_conversation_read(tests.id('dm_ab'));
select tests.check((select unread_count from public.my_conversations() where id = tests.id('dm_ab')) = 0, 'read marker');

select tests.act_as('frank@example.com');
select tests.check((select count(*) from public.messages where conversation_id = tests.id('dm_ab')) = 0, 'outsiders cannot read dms');
select tests.expect_error(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), %L)', tests.id('dm_ab'), 'spam'), 'row-level security');

-- Leaving hides a dm until the next message arrives.
select tests.act_as('bob@example.com');
select public.leave_conversation(tests.id('dm_ab'));
select tests.check((select count(*) from public.my_conversations() where id = tests.id('dm_ab')) = 0, 'left dm hidden');
select tests.act_as('alice@example.com');
insert into public.messages (conversation_id, sender_id, body) values (tests.id('dm_ab'), auth.uid(), 'Still there?');
select tests.act_as('bob@example.com');
select tests.check((select count(*) from public.my_conversations() where id = tests.id('dm_ab')) = 1, 'new message restores dm');

-- Messaging preferences.
update public.profiles set allow_messages = 'none' where id = auth.uid();
select tests.act_as('frank@example.com');
select tests.expect_error(format('select public.start_direct_conversation(%L)', tests.uid('bob@example.com')), 'not accepting messages');
reset role;
update public.profiles set allow_messages = 'following' where id = tests.uid('dave@example.com');
select tests.act_as('frank@example.com');
select tests.expect_error(format('select public.start_direct_conversation(%L)', tests.uid('dave@example.com')), 'people they follow');
select tests.act_as('dave@example.com');
insert into public.follows (follower_id, followee_id) values (auth.uid(), tests.uid('frank@example.com'));
select tests.act_as('frank@example.com');
select tests.check(public.start_direct_conversation(tests.uid('dave@example.com')) is not null, 'allowed once they follow you');
select tests.check(not (select can_message from public.get_profile(tests.uid('bob@example.com'))), 'can_message reflects policy');

-- ---------------------------------------------------------------------------
-- Crew groups + invite codes
-- ---------------------------------------------------------------------------
reset role;
update public.profiles set allow_messages = 'everyone' where id = tests.uid('dave@example.com');
select tests.act_as('alice@example.com');
select tests.remember('crew', public.create_group_conversation('Spiti crew', array[tests.uid('bob@example.com'), tests.uid('dave@example.com')]));
select tests.check((select member_count from public.my_conversations() where id = tests.id('crew')) = 2, 'bob (no messages) skipped, dave added');
select tests.check((select char_length(invite_code) from public.my_conversations() where id = tests.id('crew')) = 8, 'invite code issued');
reset role;
create table tests.codes as select invite_code from public.conversations where id = tests.id('crew');
grant select on tests.codes to authenticated;

select tests.act_as('carol@example.com');
select tests.expect_error(format('select public.join_conversation_by_code(%L)', (select invite_code from tests.codes)), 'not valid');
select tests.act_as('eve@example.com');
select tests.check(public.join_conversation_by_code(lower((select invite_code from tests.codes))) = tests.id('crew'), 'join by code (case-insensitive)');
select tests.check((select count(*) from public.conversation_messages(tests.id('crew')) where kind = 'system') = 1, 'join announced');
select tests.expect_error(format('select public.remove_conversation_member(%L, %L)', tests.id('crew'), tests.uid('dave@example.com')), 'admins');
select tests.act_as('alice@example.com');
select public.leave_conversation(tests.id('crew'));
reset role;
select tests.check((select user_id from public.conversation_members where conversation_id = tests.id('crew') and role = 'owner') = tests.uid('dave@example.com'), 'ownership handed over');
select tests.check((select count(*) from public.notifications where user_id = tests.uid('alice@example.com') and kind = 'crew_join') = 1, 'crew join notification');

-- ---------------------------------------------------------------------------
-- Destination rooms
-- ---------------------------------------------------------------------------
select tests.act_as('bob@example.com');
select tests.remember('room', public.join_place_room('kedarkantha', 'Kedarkantha'));
insert into public.messages (conversation_id, sender_id, body) values (tests.id('room'), auth.uid(), 'Anyone at Juda ka Talab tonight?');
select tests.act_as('carol@example.com');
select tests.check(public.join_place_room('kedarkantha', 'whatever') = tests.id('room'), 'one room per place');
select tests.expect_error($$select public.join_place_room('Bad Key!', 'x')$$, 'invalid place');
select tests.act_as('frank@example.com');
select tests.check((select member_count from public.place_rooms('kedar')) = 2, 'room discoverable');
select tests.check((select last_message_preview from public.place_rooms('kedar')) is null, 'preview hidden from non-members');
select tests.check((select count(*) from public.messages where conversation_id = tests.id('room')) = 0, 'join before reading');

-- ---------------------------------------------------------------------------
-- Travel board
-- ---------------------------------------------------------------------------
select tests.act_as('bob@example.com');
with ins as (insert into public.board_posts (user_id, kind, title, body, place_name, place_key, starts_on, ends_on, spots, accepted_count)
  values (auth.uid(), 'buddy', 'Spiti road trip — 1 seat left', 'Shared SUV from Manali', 'Spiti Valley', 'spiti-valley',
          current_date + 10, current_date + 18, 1, 40) returning id)
select tests.remember('board', id) from ins;
select tests.check((select accepted_count from public.board_posts where id = tests.id('board')) = 0, 'board counters server-owned');

select tests.act_as('alice@example.com');
with ins as (insert into public.board_requests (post_id, user_id, message) values (tests.id('board'), auth.uid(), 'I can drive!') returning id)
select tests.remember('req_alice', id) from ins;
select tests.act_as('dave@example.com');
with ins as (insert into public.board_requests (post_id, user_id) values (tests.id('board'), auth.uid()) returning id)
select tests.remember('req_dave', id) from ins;
select tests.check((select count(*) from public.board_requests) = 1, 'requesters only see their own request');
select tests.expect_error(format('select public.respond_board_request(%L, true)', tests.id('req_alice')), 'organiser');

select tests.act_as('bob@example.com');
select tests.check((select count(*) from public.board_requests_for_post(tests.id('board'))) = 2, 'organiser sees requests');
select tests.check((select pending_count from public.board_page() where id = tests.id('board')) = 2, 'pending counter');
select tests.remember('board_chat', public.respond_board_request(tests.id('req_alice'), true));
select tests.expect_error(format('select public.respond_board_request(%L, true)', tests.id('req_dave')), 'no spots');
select public.respond_board_request(tests.id('req_dave'), false);
select tests.check((select status from public.board_posts where id = tests.id('board')) = 'full', 'post fills up');
select tests.check((select status from public.board_page(p_post => tests.id('board'))) = 'full', 'single board post read model');

select tests.act_as('alice@example.com');
select tests.check((select my_request_status from public.board_page() where id = tests.id('board')) = 'accepted', 'request accepted');
select tests.check((select conversation_id from public.board_page() where id = tests.id('board')) = tests.id('board_chat'), 'crew chat visible to accepted');
select tests.check(public.is_conversation_member(tests.id('board_chat')), 'accepted traveller joined crew chat');
select tests.act_as('eve@example.com');
select tests.check((select conversation_id from public.board_page() where id = tests.id('board')) is null, 'crew chat hidden from others');
select tests.expect_error(format('insert into public.board_requests (post_id, user_id) values (%L, auth.uid())', tests.id('board')), 'row-level security');
reset role;
select tests.check((select count(*) from public.notifications where user_id = tests.uid('alice@example.com') and kind = 'board_accepted') = 1, 'accepted notification');
select tests.check((select count(*) from public.notifications where user_id = tests.uid('dave@example.com') and kind = 'board_declined') = 1, 'declined notification');

-- ---------------------------------------------------------------------------
-- Place tips
-- ---------------------------------------------------------------------------
select tests.act_as('carol@example.com');
with ins as (insert into public.place_tips (user_id, place_key, place_name, category, body, upvotes)
  values (auth.uid(), 'kedarkantha', 'Kedarkantha', 'water', 'Fill bottles at the stream before Juda ka Talab', 50) returning id)
select tests.remember('tip', id) from ins;
select tests.expect_error(format('insert into public.place_tip_votes (tip_id, user_id) values (%L, auth.uid())', tests.id('tip')), 'row-level security');
select tests.act_as('bob@example.com');
insert into public.place_tip_votes (tip_id, user_id) values (tests.id('tip'), auth.uid());
select tests.check((select upvotes from public.place_tips_page('kedarkantha') where id = tests.id('tip')) = 1, 'upvote counted (forged count reset)');
select tests.check((select voted_by_me from public.place_tips_page('kedarkantha') where id = tests.id('tip')), 'voted_by_me');

-- ---------------------------------------------------------------------------
-- Nearby travellers
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
select tests.expect_error($$select * from public.nearby_travellers(32.2432, 77.1892)$$, 'turn on nearby');
insert into public.presence (user_id, lat_coarse, lng_coarse, place_label, status_text, expires_at)
values (auth.uid(), 32.24321, 77.18923, 'Old Manali', 'Up for momos?', now() + interval '10 days');
select tests.check((select lat_coarse from public.presence) = 32.24, 'presence coarsened');
select tests.check((select expires_at from public.presence) <= now() + interval '24 hours', 'presence expiry capped');

select tests.act_as('bob@example.com');
insert into public.presence (user_id, lat_coarse, lng_coarse, place_label) values (auth.uid(), 32.2396, 77.1887, 'Manali');
select tests.act_as('dave@example.com');
insert into public.presence (user_id, lat_coarse, lng_coarse, place_label) values (auth.uid(), 28.6139, 77.2090, 'Delhi');
select tests.act_as('carol@example.com');
insert into public.presence (user_id, lat_coarse, lng_coarse) values (auth.uid(), 32.25, 77.19);
select tests.act_as('eve@example.com');
update public.profiles set is_discoverable = false where id = auth.uid();
insert into public.presence (user_id, lat_coarse, lng_coarse) values (auth.uid(), 32.24, 77.18);

select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.nearby_travellers(32.2432, 77.1892, 25)) = 1, 'only bob is visible nearby');
select tests.check((select username from public.nearby_travellers(32.2432, 77.1892, 25)) = 'bob', 'bob nearby');
select tests.check((select distance_km from public.nearby_travellers(32.2432, 77.1892, 25)) >= 1, 'distance floored to 1 km');
select tests.check((select count(*) from public.presence) = 1, 'raw presence rows stay private');

-- ---------------------------------------------------------------------------
-- Trip matching
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
with ins as (insert into public.trips (user_id, title, destination, place_key, starts_on, ends_on, open_to_meet)
  values (auth.uid(), 'Kedarkantha winter', 'Kedarkantha', 'kedarkantha', current_date + 30, current_date + 35, true) returning id)
select tests.remember('trip_alice', id) from ins;
select tests.act_as('bob@example.com');
with ins as (insert into public.trips (user_id, title, destination, place_key, starts_on, ends_on, open_to_meet)
  values (auth.uid(), 'KK with college gang', 'Kedarkantha', 'kedarkantha', current_date + 33, current_date + 37, true) returning id)
select tests.remember('trip_bob', id) from ins;
select tests.act_as('dave@example.com');
insert into public.trips (user_id, title, place_key, starts_on, ends_on, open_to_meet)
  values (auth.uid(), 'Later KK', 'kedarkantha', current_date + 90, current_date + 95, true);
select tests.act_as('carol@example.com');
update public.trips set starts_on = current_date + 31, ends_on = current_date + 34, open_to_meet = true where id = tests.id('carol_trip');

select tests.act_as('alice@example.com');
select tests.check((select count(*) from public.find_trip_matches(tests.id('trip_alice'))) = 1, 'one match (dave too late, carol blocked)');
select tests.check((select overlap_days from public.find_trip_matches(tests.id('trip_alice'))) = 3, 'overlap days');
select tests.check((select count(*) from public.notifications where kind = 'trip_match') = 1, 'alice notified of bob');
update public.trips set open_to_meet = false where id = tests.id('trip_alice');
select tests.check((select count(*) from public.find_trip_matches(tests.id('trip_alice'))) = 0, 'reciprocal: closed trips see nobody');
select tests.act_as('bob@example.com');
select tests.expect_error(format('select * from public.find_trip_matches(%L)', tests.id('trip_alice')), 'not found');
select tests.check((select count(*) from public.notifications where kind = 'trip_match') = 2, 'bob notified of alice + carol');
select tests.act_as('frank@example.com');
select tests.check((select count(*) from public.travellers_heading_to('kedarkantha')) = 3, 'heading-to list (bob, carol, dave)');

-- ---------------------------------------------------------------------------
-- Verified routes + stats
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude, altitude_m, accuracy_m)
select tests.id('trip_alice'), auth.uid(), now() - interval '3 hours' + (i * interval '10 minutes'),
       31.0200 + i * 0.009, 78.1700, 2800 + i * 120, 10
from generate_series(0, 10) as i;
-- A GPS glitch 1,000 km away one second later must not count.
insert into public.track_points (trip_id, user_id, recorded_at, latitude, longitude, altitude_m, accuracy_m)
values (tests.id('trip_alice'), auth.uid(), now() - interval '3 hours' + interval '1 second', 40.0, 78.17, 3000, 10);
with ins as (insert into public.posts (user_id, kind, body, trip_id, include_route, route_km)
  values (auth.uid(), 'trip', 'Kedarkantha done!', tests.id('trip_alice'), true, 9999) returning id)
select tests.remember('route_post', id) from ins;
select tests.check((select route_km from public.posts where id = tests.id('route_post')) between 9.5 and 10.5, 'server-computed route km, glitch ignored');
select tests.check((select jsonb_array_length(route_preview) from public.posts where id = tests.id('route_post')) = 11, 'route preview without the spike');
select tests.check((public.refresh_my_stats() ->> 'tier') = 'hardcore', 'tier from verified stats (4000 m reached)');
select tests.check((select max_altitude_m from public.profiles where id = auth.uid()) = 4000, 'max altitude');
select tests.check((select trips_count from public.profiles where id = auth.uid()) = 1, 'trip count');
-- The private everyday journal syncs as a trip but is not a journey, so it is not counted.
insert into public.trips (user_id, title, trip_type) values (auth.uid(), 'Everyday journal', 'everyday');
select tests.check((public.refresh_my_stats() ->> 'trips_count')::int = 1, 'everyday journal is not counted as a trip');

-- ---------------------------------------------------------------------------
-- Live location + shared trips (anon viewers)
-- ---------------------------------------------------------------------------
select tests.act_as('alice@example.com');
with ins as (insert into public.live_shares (user_id, label, latitude, longitude, expires_at)
  values (auth.uid(), 'Kedarkantha summit push', 31.02, 78.17, now() + interval '2 hours') returning id)
select tests.remember('live', id) from ins;
select tests.expect_error($$insert into public.live_shares (user_id, latitude, longitude, expires_at) values (auth.uid(), 1, 1, now() + interval '5 days')$$, 'check');
update public.trips set share_id = 'share-alice-123', visibility = 'link' where id = tests.id('trip_alice');
insert into public.entries (trip_id, user_id, body, mood) values (tests.id('trip_alice'), auth.uid(), 'Day 1: Sankri to Juda ka Talab', '😊 Great');

select tests.act_as_anon();
select tests.check((public.get_live_share(tests.id('live')) ->> 'active')::boolean, 'anon can view live link');
select tests.check((public.get_live_share(tests.id('live')) ->> 'display_name') = 'Alice', 'live link names traveller');
select tests.check((select count(*) from public.live_shares) = 0, 'anon cannot list live shares');
select tests.check((public.get_shared_trip('share-alice-123') -> 'author' ->> 'username') is null, 'shared trip shows no username');
select tests.check((public.get_shared_trip('share-alice-123')::jsonb -> 'trip') ? 'title', 'shared trip payload');
select tests.check(not ((public.get_shared_trip('share-alice-123')::jsonb -> 'trip') ? 'user_id'), 'shared trip hides user ids');
select tests.check(json_array_length(public.get_shared_trip('share-alice-123') -> 'entries') = 1, 'shared entries');
select tests.check(public.get_shared_trip('nope-nope-nope') is null, 'unknown share id');

-- Revocation keeps the ended-state response, but never the last precise coordinates.
select tests.act_as('alice@example.com');
update public.live_shares set expires_at = now() - interval '1 second' where id = tests.id('live');
select tests.act_as_anon();
select tests.check(not (public.get_live_share(tests.id('live')) ->> 'active')::boolean, 'revoked link is inactive');
select tests.check((public.get_live_share(tests.id('live')) ->> 'latitude') is null, 'revoked link hides latitude');
select tests.check((public.get_live_share(tests.id('live')) ->> 'longitude') is null, 'revoked link hides longitude');
select tests.check((public.get_live_share(tests.id('live')) ->> 'accuracy_m') is null, 'revoked link hides accuracy');

-- ---------------------------------------------------------------------------
-- Account deletion cascades and keeps counters honest
-- ---------------------------------------------------------------------------
reset role;
select tests.check((select followers_count from public.profiles where id = tests.uid('bob@example.com')) = 2, 'bob followers before deletion');
select tests.act_as('dave@example.com');
select public.delete_my_account();
reset role;
select tests.check(not exists (select 1 from auth.users where email = 'dave@example.com'), 'auth user deleted');
select tests.check(not exists (select 1 from public.profiles where id = tests.uid('dave@example.com')), 'profile deleted');
select tests.check((select followers_count from public.profiles where id = tests.uid('bob@example.com')) = 1, 'follower counter after deletion');
select tests.check(not exists (select 1 from public.trips where user_id = tests.uid('dave@example.com')), 'trips deleted');

reset role;
\o
\pset tuples_only on
select 'social + connect tests passed (' || (select count(*) from tests.ids) || ' fixtures)' as result;
