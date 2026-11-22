-- Shared journeys.
--
-- The person who starts a journey (the owner) can add people by username, each either
-- "can add" (editor: adds their own moments, plan items and expenses) or "view only" (viewer).
--
-- Rules, enforced here rather than in the app:
--   * Everyone in a journey can read its moments, photos, plan and expenses.
--   * Owners and editors write only rows they authored. The owner may also delete any row in the journey.
--   * Packing lists and recorded routes stay personal: you only ever see your own.
--   * Only the owner edits the journey itself, adds people or changes their access.
--   * A member can leave. What they added stays with the journey; they lose access to it.
--
-- This also closes an older gap: rows were checked only for "user_id is me", so anyone could
-- attach a row to someone else's journey id. Every write now checks access to the journey.

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_members_user_idx on public.trip_members (user_id);
create index if not exists entry_media_storage_path_idx on public.entry_media (storage_path);

alter table public.trip_members enable row level security;

-- 'owner', 'editor', 'viewer', or null when the signed-in person has no access to the journey.
create or replace function public.trip_role(p_trip uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or p_trip is null then null
    when exists (select 1 from public.trips t where t.id = p_trip and t.user_id = auth.uid()) then 'owner'
    else (select m.role from public.trip_members m where m.trip_id = p_trip and m.user_id = auth.uid())
  end
$$;

revoke all on function public.trip_role(uuid) from public, anon;
grant execute on function public.trip_role(uuid) to authenticated;

-- Members: everyone in the journey sees who is in it. The owner removes people; anyone can leave.
-- Adding people and changing access goes through add_trip_member() only.
revoke all on public.trip_members from anon;
revoke insert, update on public.trip_members from authenticated;
grant select, delete on public.trip_members to authenticated;

drop policy if exists trip_members_select on public.trip_members;
drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_select on public.trip_members
  for select to authenticated using (public.trip_role(trip_id) is not null);
create policy trip_members_delete on public.trip_members
  for delete to authenticated using (user_id = auth.uid() or public.trip_role(trip_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Journeys
-- ---------------------------------------------------------------------------
drop policy if exists trips_all_own on public.trips;
drop policy if exists trips_select on public.trips;
drop policy if exists trips_insert_own on public.trips;
drop policy if exists trips_update_own on public.trips;
drop policy if exists trips_delete_own on public.trips;
create policy trips_select on public.trips
  for select to authenticated using (user_id = auth.uid() or public.trip_role(id) is not null);
create policy trips_insert_own on public.trips
  for insert to authenticated with check (user_id = auth.uid());
create policy trips_update_own on public.trips
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trips_delete_own on public.trips
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared rows: moments, photos, plan items, expenses
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  old_policy text;
begin
  foreach t in array array['entries', 'expenses', 'itinerary_items', 'entry_media'] loop
    old_policy := case t
      when 'entries' then 'entries_all_own'
      when 'expenses' then 'expenses_all_own'
      when 'itinerary_items' then 'itinerary_all_own'
      else 'entry_media_all_own'
    end;
    execute format('drop policy if exists %I on public.%I', old_policy, t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.trip_role(trip_id) is not null)',
      t || '_select', t);
    execute format(
      $f$create policy %I on public.%I for insert to authenticated
         with check (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'))$f$,
      t || '_insert', t);
    execute format(
      $f$create policy %I on public.%I for update to authenticated
         using (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'))
         with check (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'))$f$,
      t || '_update', t);
    execute format(
      $f$create policy %I on public.%I for delete to authenticated
         using ((user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'))
                or public.trip_role(trip_id) = 'owner')$f$,
      t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Personal rows: packing list (anyone in the journey keeps their own) and recorded route
-- ---------------------------------------------------------------------------
drop policy if exists packing_all_own on public.packing_items;
drop policy if exists packing_own on public.packing_items;
create policy packing_own on public.packing_items
  for all to authenticated
  using (user_id = auth.uid() and public.trip_role(trip_id) is not null)
  with check (user_id = auth.uid() and public.trip_role(trip_id) is not null);

drop policy if exists track_all_own on public.track_points;
drop policy if exists track_select_own on public.track_points;
drop policy if exists track_insert_own on public.track_points;
drop policy if exists track_update_own on public.track_points;
drop policy if exists track_delete_own on public.track_points;
create policy track_select_own on public.track_points
  for select to authenticated using (user_id = auth.uid() and public.trip_role(trip_id) is not null);
create policy track_insert_own on public.track_points
  for insert to authenticated with check (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'));
create policy track_update_own on public.track_points
  for update to authenticated
  using (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'))
  with check (user_id = auth.uid() and public.trip_role(trip_id) in ('owner', 'editor'));
create policy track_delete_own on public.track_points
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Photo files: people in a journey can open each other's photos in it.
-- Uploads stay in the uploader's own folder (the existing *_own storage policies).
-- ---------------------------------------------------------------------------
drop policy if exists entry_media_storage_select_member on storage.objects;
create policy entry_media_storage_select_member on storage.objects
  for select to authenticated using (
    bucket_id = 'entry-media'
    and exists (
      select 1 from public.entry_media em
      where em.storage_path = storage.objects.name
        and public.trip_role(em.trip_id) is not null
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Owner adds someone by username, or changes their access if they are already in.
create or replace function public.add_trip_member(p_trip uuid, p_username text, p_role text)
returns table (user_id uuid, username text, display_name text, avatar_path text, role text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_handle text := lower(trim(both '@' from trim(coalesce(p_username, ''))));
  v_target public.profiles%rowtype;
begin
  if v_me is null then
    raise exception 'Sign in to share a journey' using errcode = '28000';
  end if;
  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'Choose "can add" or "view only"' using errcode = '22023';
  end if;
  if not exists (select 1 from public.trips t where t.id = p_trip and t.user_id = v_me) then
    raise exception 'Only the person who started this journey can add people' using errcode = '42501';
  end if;

  select * into v_target from public.profiles p where p.username = v_handle;
  if not found or public._blocked_between(v_me, v_target.id) then
    raise exception 'No traveller with that username' using errcode = 'P0002';
  end if;
  if v_target.id = v_me then
    raise exception 'That is your own username' using errcode = '22023';
  end if;
  if not exists (select 1 from public.trip_members m where m.trip_id = p_trip and m.user_id = v_target.id)
     and (select count(*) from public.trip_members m where m.trip_id = p_trip) >= 20 then
    raise exception 'A journey can have up to 20 people' using errcode = 'P0001';
  end if;

  insert into public.trip_members as m (trip_id, user_id, role, added_by)
  values (p_trip, v_target.id, p_role, v_me)
  on conflict on constraint trip_members_pkey do update set role = excluded.role;

  return query select v_target.id, v_target.username, v_target.display_name, v_target.avatar_path, p_role;
end;
$$;

revoke all on function public.add_trip_member(uuid, text, text) from public, anon;
grant execute on function public.add_trip_member(uuid, text, text) to authenticated;

-- Everyone in a journey, owner first, with names for display.
create or replace function public.trip_people(p_trip uuid)
returns table (user_id uuid, username text, display_name text, avatar_path text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select x.user_id, x.username, x.display_name, x.avatar_path, x.role
  from (
    select p.id as user_id, p.username, p.display_name, p.avatar_path, 'owner'::text as role, 0 as rank, t.created_at as since
    from public.trips t join public.profiles p on p.id = t.user_id
    where t.id = p_trip
    union all
    select p.id, p.username, p.display_name, p.avatar_path, m.role, 1, m.created_at
    from public.trip_members m join public.profiles p on p.id = m.user_id
    where m.trip_id = p_trip
  ) x
  where public.trip_role(p_trip) is not null
  order by x.rank, x.since
$$;

revoke all on function public.trip_people(uuid) from public, anon;
grant execute on function public.trip_people(uuid) to authenticated;

-- Every journey I'm part of that involves other people: ones shared with me, and mine that I shared.
create or replace function public.my_trip_shares()
returns table (trip_id uuid, role text, owner_id uuid, owner_username text, owner_name text, people int)
language sql
stable
security definer
set search_path = public
as $$
  select m.trip_id, m.role, t.user_id, p.username, p.display_name,
    (select count(*)::int from public.trip_members x where x.trip_id = m.trip_id) + 1
  from public.trip_members m
  join public.trips t on t.id = m.trip_id
  join public.profiles p on p.id = t.user_id
  where m.user_id = auth.uid()
  union all
  select t.id, 'owner'::text, t.user_id, null::text, null::text, count(m.user_id)::int + 1
  from public.trips t
  join public.trip_members m on m.trip_id = t.id
  where t.user_id = auth.uid()
  group by t.id, t.user_id
$$;

revoke all on function public.my_trip_shares() from public, anon;
grant execute on function public.my_trip_shares() to authenticated;
