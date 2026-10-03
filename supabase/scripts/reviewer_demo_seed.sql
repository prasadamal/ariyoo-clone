-- Wayfare App Store / Play review demo data
-- 1. Create user in Supabase Auth UI (or sign up in app)
-- 2. Replace :user_id with auth.users.id UUID

-- Example (replace UUID):
-- insert into public.trips (id, user_id, title, trip_type, destination, status, notes)
-- values (
--   '11111111-1111-4111-8111-111111111111',
--   'YOUR_USER_UUID_HERE',
--   'Everest Base Camp Trek (demo)',
--   'trek',
--   'Khumbu, Nepal',
--   'active',
--   'Sample trip for store reviewers — safe to delete.'
-- );

select 'Edit this file with your reviewer user UUID, then run in SQL editor.' as hint;
