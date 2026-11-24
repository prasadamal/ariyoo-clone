-- Hardening from the Supabase advisor (November 2026 audit). Safe to run more than once.
--
-- 1. Pin search_path on four pure helper functions ("Function Search Path Mutable").
--    They only do arithmetic, so pinning it changes nothing about what they return.
alter function public._haversine_m(double precision, double precision, double precision, double precision) set search_path = public;
alter function public._km_between(double precision, double precision, double precision, double precision) set search_path = public;
alter function public._trip_overlap_days(date, date, date, date, integer) set search_path = public;
alter function public.compute_tier(numeric, numeric) set search_path = public;

-- 2. Index the user_id foreign keys of journal tables ("Unindexed foreign keys"). Deleting an
--    account cascades through these; without an index each cascade scans the whole table.
create index if not exists entries_user_id_idx on public.entries (user_id);
create index if not exists entry_media_user_id_idx on public.entry_media (user_id);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists itinerary_items_user_id_idx on public.itinerary_items (user_id);
create index if not exists packing_items_user_id_idx on public.packing_items (user_id);
create index if not exists track_points_user_id_idx on public.track_points (user_id);
create index if not exists trip_members_added_by_idx on public.trip_members (added_by);
