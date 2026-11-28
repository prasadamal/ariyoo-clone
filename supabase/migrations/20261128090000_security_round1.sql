-- Security round 1 (audit of 27 Nov 2026: SEC-01, SEC-02, SEC-03, SEC-05, social functions).
-- 1. A photo row may only point at a file in its author's own folder, and photo files are only
--    readable through a row written by the file's owner.
-- 2. Only the journey's owner decides who can see it (visibility, story link, open to meet, type).
-- 3. Profiles: you read your own row and the people you share a journey with. Username lookup
--    for adding crew and your member number go through two small functions instead.
-- 4. Social, chat, nearby and matching are switched off on the server until the social launch,
--    and post photos are no longer public. A later migration turns them back on with consent rules.

-- =============================================================================================
-- 1. Photos and voice notes tied to their owner's folder (SEC-01)
-- =============================================================================================
alter table public.entry_media drop constraint if exists entry_media_path_in_own_folder;
alter table public.entry_media add constraint entry_media_path_in_own_folder
  check (storage_path is null or split_part(storage_path, '/', 1) = user_id::text);

drop policy if exists entry_media_storage_select_member on storage.objects;
create policy entry_media_storage_select_member on storage.objects
  for select to authenticated using (
    bucket_id = 'entry-media'
    and exists (
      select 1 from public.entry_media em
      where em.storage_path = storage.objects.name
        and split_part(storage.objects.name, '/', 1) = em.user_id::text
        and public.trip_role(em.trip_id) is not null
    )
  );

create or replace function public.is_story_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entry_media m
    join public.trips t on t.id = m.trip_id
    where m.storage_path = p_name
      and split_part(p_name, '/', 1) = m.user_id::text
      and t.visibility = 'link'
      and t.share_id is not null
      and t.trip_type <> 'everyday'
      and coalesce(m.mime_type, '') not like 'audio%'
  )
$$;
revoke all on function public.is_story_photo(text) from public;
grant execute on function public.is_story_photo(text) to anon, authenticated;

-- =============================================================================================
-- 2. Only the owner changes who can see a journey (SEC-02)
--    Crew admins still edit title, dates, place and the rest. Their changes to the sharing fields
--    are dropped quietly (an old offline edit can't revive a stopped story). Site moderators may
--    only switch a story off.
-- =============================================================================================
create or replace function public._owner_controls_sharing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or auth.uid() is null or auth.uid() = old.user_id then
    return new;  -- the server itself, or the owner
  end if;
  if public.is_admin() and new.visibility = 'private' and new.share_id is null then
    return new;  -- a moderator turning a reported story off
  end if;
  new.visibility := old.visibility;
  new.share_id := old.share_id;
  new.open_to_meet := old.open_to_meet;
  new.trip_type := old.trip_type;
  return new;
end;
$$;

drop trigger if exists trips_owner_controls_sharing on public.trips;
create trigger trips_owner_controls_sharing before update on public.trips
  for each row execute function public._owner_controls_sharing();

-- =============================================================================================
-- 3. Profiles: yourself and your crew only (SEC-03)
-- =============================================================================================
create or replace function public.shares_trip_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and p_other is not null and exists (
    select 1
    from public.trips t
    where (t.user_id = auth.uid()
           or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
      and (t.user_id = p_other
           or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = p_other))
  )
$$;
revoke all on function public.shares_trip_with(uuid) from public, anon;
grant execute on function public.shares_trip_with(uuid) to authenticated;

drop policy if exists profiles_select_visible on public.profiles;
drop policy if exists profiles_select_own_or_crew on public.profiles;
create policy profiles_select_own_or_crew on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));

-- Adding crew: look someone up by their exact username (only what the preview shows).
create or replace function public.find_traveller(p_username text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where auth.uid() is not null
    and p.username = lower(trim(p_username))
    and not public.blocked_with_me(p.id)
  limit 1
$$;
revoke all on function public.find_traveller(text) from public, anon;
grant execute on function public.find_traveller(text) to authenticated;

-- "You're our 452nd traveller": counts accounts without reading anyone else's row.
create or replace function public.my_member_number()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.profiles p
  where auth.uid() is not null
    and p.created_at <= (select created_at from public.profiles where id = auth.uid())
$$;
revoke all on function public.my_member_number() from public, anon;
grant execute on function public.my_member_number() to authenticated;

-- =============================================================================================
-- 4. Social, chat, nearby and matching off until launch (SOC-01..08, SEC-05)
-- =============================================================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'board_page', 'board_requests_for_post', 'respond_board_request',
        'conversation_members_list', 'conversation_messages', 'create_group_conversation',
        'join_conversation_by_code', 'join_place_room', 'leave_conversation', 'mark_conversation_read',
        'my_conversations', 'remove_conversation_member', 'start_direct_conversation',
        'feed_page', 'post_comments_page', 'list_follows', 'get_profile', 'search_travellers',
        'suggested_travellers', 'notifications_page', 'place_rooms', 'place_tips_page',
        'nearby_travellers', 'travellers_heading_to', 'find_trip_matches'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Writes to the social tables are blocked by a restrictive rule (dropping these policies at
-- launch restores the normal rules; nothing else about the tables changes).
do $$
declare
  t text;
begin
  foreach t in array array[
    'posts', 'post_comments', 'post_likes', 'follows', 'messages', 'board_posts', 'board_requests',
    'place_tips', 'place_tip_votes', 'presence'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists social_off_insert on public.%I', t);
      execute format('drop policy if exists social_off_update on public.%I', t);
      execute format('create policy social_off_insert on public.%I as restrictive for insert to anon, authenticated with check (false)', t);
      execute format('create policy social_off_update on public.%I as restrictive for update to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;

update storage.buckets set public = false where id = 'post-media';
