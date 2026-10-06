-- Wayfare App Store / Play review demo data (safe to re-run: removes previous demo rows first).
--
-- 1. Sign up two accounts in the app (or Supabase Auth):
--      wayfare.reviewer@example.com   (give its password to the reviewer)
--      wayfare.buddy@example.com      (a second traveller so community features have content)
-- 2. Run this whole file in the Supabase SQL editor. Edit the emails below if you used others.
--
-- The reviewer account is left WITHOUT accepted community guidelines on purpose, so App Review
-- sees the guidelines gate before any community feature.

do $$
declare
  reviewer uuid := (select id from auth.users where email = 'wayfare.reviewer@example.com');
  buddy uuid := (select id from auth.users where email = 'wayfare.buddy@example.com');
  trip_reviewer uuid := gen_random_uuid();
  trip_buddy uuid := gen_random_uuid();
  conv uuid;
  direct text;
begin
  if reviewer is null or buddy is null then
    raise exception 'Create wayfare.reviewer@example.com and wayfare.buddy@example.com first';
  end if;

  -- Clean previous demo data.
  delete from public.trips where user_id in (reviewer, buddy) and title like '%(demo)%';
  delete from public.posts where user_id = buddy and body like '%#wayfaredemo%';
  delete from public.board_posts where user_id = buddy and title like '%(demo)%';
  direct := least(reviewer::text, buddy::text) || ':' || greatest(reviewer::text, buddy::text);
  delete from public.conversations where direct_key = direct;
  delete from public.notifications where user_id in (reviewer, buddy) and actor_id in (reviewer, buddy);

  update public.profiles
  set display_name = 'Riya (demo)', bio = 'Weekend trekker from Delhi. Up for chai and sunrise hikes.',
      travel_styles = '{trekker,photographer,budget}', home_region = 'Delhi', home_country = 'India',
      guidelines_accepted_at = now()
  where id = buddy;
  update public.profiles
  set bio = 'Testing Wayfare for review.', travel_styles = '{trekker,backpacker}', home_region = 'Bengaluru'
  where id = reviewer;

  insert into public.trips (id, user_id, title, trip_type, destination, place_key, starts_on, ends_on, open_to_meet, companions, notes, updated_at)
  values
    (trip_reviewer, reviewer, 'Hampta Pass (demo)', 'trek', 'Hampta Pass', 'hampta-pass',
     current_date + 20, current_date + 24, true, 'Asha, Kabir', 'Best season: Jun–Sep. Jeep from Manali to Jobra.', now()),
    (trip_buddy, buddy, 'Hampta crossing (demo)', 'trek', 'Hampta Pass', 'hampta-pass',
     current_date + 21, current_date + 25, true, null, null, now());

  insert into public.entries (trip_id, user_id, recorded_at, body, mood, place_name, weather, updated_at) values
    (trip_reviewer, reviewer, now() - interval '2 days', 'Packed and ready — Volvo to Manali tonight!', '😊 Great', 'Delhi', 'Clear, 31°C', now()),
    (trip_reviewer, reviewer, now() - interval '1 day', 'Old Manali cafés, then gear check for the pass.', '😌 Calm', 'Old Manali', 'Partly cloudy, 18°C', now());

  insert into public.expenses (trip_id, user_id, category, amount, currency, note, spent_on, paid_by, split_with, updated_at) values
    (trip_reviewer, reviewer, 'transport', 4200, 'INR', 'Volvo tickets', current_date - 2, null, '["Me","Asha","Kabir"]', now()),
    (trip_reviewer, reviewer, 'stay', 2700, 'INR', 'Homestay', current_date - 1, 'Asha', '["Me","Asha","Kabir"]', now());

  insert into public.posts (user_id, kind, body, place_name, place_key, trip_id, visibility)
  values (buddy, 'moment', 'Balu ka Ghera meadows were unreal this morning 🏔 Anyone else crossing Hampta next week? #wayfaredemo',
          'Hampta Pass', 'hampta-pass', trip_buddy, 'public');

  insert into public.board_posts (user_id, kind, title, body, place_name, place_key, starts_on, ends_on, spots, budget_level)
  values (buddy, 'ride', 'Sharing a jeep Manali → Jobra (demo)', 'Leaving 7 am, splitting the fare four ways.', 'Hampta Pass', 'hampta-pass',
          current_date + 21, current_date + 21, 3, 'shoestring');

  insert into public.follows (follower_id, followee_id) values (buddy, reviewer) on conflict do nothing;

  insert into public.conversations (kind, direct_key, created_by) values ('direct', direct, buddy) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id) values (conv, reviewer), (conv, buddy);
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, buddy, 'text', 'Hey! Saw we are both on Hampta around the same dates — want to share the jeep from Manali?');
end $$;

select 'Demo data ready: reviewer has a matched trip, a post in the feed, a board post and an unread chat.' as result;
