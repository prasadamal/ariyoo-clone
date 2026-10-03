-- Wayfare store-review demo data.
-- 1. Create the reviewer user in Supabase Auth (auto-confirm), e.g. reviewer@wayfare.app
-- 2. Edit the email below and run this script in the SQL editor.
-- Safe to re-run: it only inserts when the demo trip does not exist yet.
do $$
declare
  reviewer_email constant text := 'reviewer@wayfare.app';
  uid uuid;
  tid constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  select id into uid from auth.users where email = reviewer_email;
  if uid is null then
    raise exception 'No auth user with email %', reviewer_email;
  end if;

  if exists (select 1 from public.trips where id = tid) then
    raise notice 'Demo trip already present';
    return;
  end if;

  insert into public.trips (id, user_id, title, trip_type, destination, status, notes)
  values (tid, uid, 'Kedarkantha Winter Trek (demo)', 'trek', 'Uttarakhand', 'active',
          'Sample trip for store reviewers — safe to delete.');

  insert into public.entries (trip_id, user_id, recorded_at, body, mood, place_name, weather) values
    (tid, uid, now() - interval '2 days', 'Reached Sankri. Chai, bags sorted, early start tomorrow.', '😌 Calm', 'Sankri', 'Clear, 8°C'),
    (tid, uid, now() - interval '1 day',  'Snow all the way to Juda ka Talab. Frozen lake at sunset was unreal.', '🔥 Epic', 'Juda ka Talab', 'Snow, -3°C');

  insert into public.expenses (trip_id, user_id, category, amount, spent_on) values
    (tid, uid, 'transport', 2400, current_date - 2),
    (tid, uid, 'food', 650, current_date - 1);

  insert into public.packing_items (trip_id, user_id, label, packed, sort_order) values
    (tid, uid, 'Thermals', true, 0),
    (tid, uid, 'Gaiters', false, 1);
end $$;
