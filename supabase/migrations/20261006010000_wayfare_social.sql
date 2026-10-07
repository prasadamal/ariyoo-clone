-- Wayfare social layer: public traveller profiles, follows, posts (moments + trip stories),
-- likes, comments, blocks, reports, in-app notifications and push tokens.

-- ===========================================================================
-- Shared internal helpers
-- ===========================================================================

-- Blocks come first: almost every policy below consults them.
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public._blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Throws when a user created too many rows recently (anti-spam).
create or replace function public._enforce_rate_limit(
  p_table regclass,
  p_user_col text,
  p_user uuid,
  p_window interval,
  p_max int,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  execute format('select count(*) from %s where %I = $1 and created_at > now() - $2', p_table, p_user_col)
    into n using p_user, p_window;
  if n >= p_max then
    raise exception 'Slow down: too many % right now. Try again a little later.', p_label
      using errcode = 'P0001';
  end if;
end;
$$;

-- ===========================================================================
-- Blocks (needed by almost every policy below)
-- ===========================================================================

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists blocks_select_own on public.blocks;
drop policy if exists blocks_insert_own on public.blocks;
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

revoke update on public.blocks from anon, authenticated;

-- Client-safe: only reveals blocks that involve the caller.
create or replace function public.blocked_with_me(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._blocked_between(auth.uid(), p_other)
$$;

revoke all on function public._blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public._enforce_rate_limit(regclass, text, uuid, interval, int, text) from public, anon, authenticated;
revoke all on function public.blocked_with_me(uuid) from public, anon;
grant execute on function public.blocked_with_me(uuid) to authenticated;

-- ===========================================================================
-- Profiles v2
-- ===========================================================================

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists avatar_path text,
  add column if not exists home_country text,
  add column if not exists travel_styles text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists is_discoverable boolean not null default true,
  add column if not exists allow_messages text not null default 'everyone',
  add column if not exists guidelines_accepted_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists verified_km numeric(10, 2) not null default 0,
  add column if not exists max_altitude_m numeric(8, 1) not null default 0,
  add column if not exists trips_count int not null default 0,
  add column if not exists followers_count int not null default 0,
  add column if not exists following_count int not null default 0,
  add column if not exists posts_count int not null default 0,
  add column if not exists stats_updated_at timestamptz;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,24}$');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_bio_length check (bio is null or char_length(bio) <= 280);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_allow_messages_check check (allow_messages in ('everyone', 'following', 'none'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 60);
exception when duplicate_object then null;
end $$;

create unique index if not exists profiles_username_key on public.profiles (username);

create or replace function public.generate_username(p_seed text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  base text := lower(regexp_replace(coalesce(p_seed, ''), '[^a-zA-Z0-9_]', '', 'g'));
  candidate text;
  i int := 0;
begin
  if char_length(base) < 3 then
    base := 'traveller';
  end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    if i > 40 then
      return 'traveller_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    end if;
    candidate := base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_username(text) from public, anon, authenticated;

-- Signup trigger: create the profile with a unique handle (username can be chosen at signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'traveller'), '@', 1)
  ), 60);
  v_seed text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, 'traveller'), '@', 1)
  );
  attempt int := 0;
begin
  loop
    begin
      insert into public.profiles (id, display_name, username)
      values (new.id, v_name, public.generate_username(v_seed))
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt >= 5 then
        insert into public.profiles (id, display_name) values (new.id, v_name) on conflict (id) do nothing;
        exit;
      end if;
    end;
  end loop;
  return new;
end;
$$;

-- Backfill handles for existing travellers, one row at a time so each sees the previous.
do $$
declare
  r record;
begin
  for r in select id, display_name from public.profiles where username is null loop
    update public.profiles
    set username = public.generate_username(coalesce(r.display_name, 'traveller'))
    where id = r.id;
  end loop;
end $$;

-- Authenticated travellers can see each other (except across a block).
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles
  for select to authenticated
  using (id = auth.uid() or not public.blocked_with_me(id));

-- Verified stats, tier and counters are server-maintained: clients may only edit these columns.
revoke insert, update on public.profiles from anon, authenticated;
grant update (
  display_name, home_region, privacy_default, username, bio, avatar_path, home_country,
  travel_styles, languages, is_discoverable, allow_messages, guidelines_accepted_at, last_active_at,
  updated_at
) on public.profiles to authenticated;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[a-z0-9_.]{3,24}$'
    and not exists (
      select 1 from public.profiles
      where username = p_username and id is distinct from auth.uid()
    )
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ===========================================================================
-- Notifications (written only by triggers / definer functions)
-- ===========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'follow', 'like', 'comment', 'board_request', 'board_accepted', 'board_declined',
    'trip_match', 'tip_upvote', 'crew_join', 'system'
  )),
  entity_type text,
  entity_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public._notify(
  p_user uuid,
  p_actor uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_user is not distinct from p_actor then
    return;
  end if;
  if p_actor is not null and public._blocked_between(p_user, p_actor) then
    return;
  end if;
  -- Collapse repeats (e.g. like / unlike / like) within a day.
  if exists (
    select 1 from public.notifications
    where user_id = p_user
      and actor_id is not distinct from p_actor
      and kind = p_kind
      and entity_id is not distinct from p_entity_id
      and created_at > now() - interval '1 day'
  ) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, entity_type, entity_id, body)
  values (p_user, p_actor, p_kind, p_entity_type, p_entity_id, left(p_body, 200));
end;
$$;

revoke all on function public._notify(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;

create or replace function public.mark_notifications_read()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Push tokens (Expo). Registered through a definer RPC so a device can switch accounts.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated using (user_id = auth.uid());

revoke insert, update on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or char_length(p_token) < 10 or char_length(p_token) > 300 then
    raise exception 'invalid push token';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), left(p_platform, 20), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ===========================================================================
-- Follows
-- ===========================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists follows_select_visible on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_select_visible on public.follows for select to authenticated
  using (not public.blocked_with_me(follower_id) and not public.blocked_with_me(followee_id));
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.blocked_with_me(followee_id));
-- Unfollow, or remove one of your own followers.
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

revoke update on public.follows from anon, authenticated;

create or replace function public.on_follow_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.follows', 'follower_id', new.follower_id, interval '1 hour', 200, 'follows');
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    perform public._notify(new.followee_id, new.follower_id, 'follow', 'profile', new.follower_id);
    return new;
  end if;
  update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
  update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  return old;
end;
$$;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.on_follow_before_insert();

drop trigger if exists follows_counts on public.follows;
create trigger follows_counts after insert or delete on public.follows
  for each row execute function public.on_follow_change();

-- Blocking someone also removes follows in both directions.
create or replace function public.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_cleanup on public.blocks;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block_created();

-- ===========================================================================
-- Posts (moments, trip stories, milestones)
-- ===========================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'moment' check (kind in ('moment', 'trip', 'milestone')),
  body text check (body is null or char_length(body) <= 2000),
  trip_id uuid references public.trips (id) on delete set null,
  entry_id uuid references public.entries (id) on delete set null,
  place_name text check (place_name is null or char_length(place_name) <= 120),
  place_key text check (place_key is null or place_key ~ '^[a-z0-9-]{2,60}$'),
  latitude double precision,
  longitude double precision,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  media jsonb not null default '[]'::jsonb,
  include_route boolean not null default false,
  route_km numeric(10, 2),
  route_preview jsonb,
  stats jsonb,
  like_count int not null default 0,
  comment_count int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  check (coalesce(char_length(trim(body)), 0) > 0 or jsonb_array_length(media) > 0 or include_route)
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
create index if not exists posts_place_idx on public.posts (place_key, created_at desc);

alter table public.posts enable row level security;

drop policy if exists posts_select_visible on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
create policy posts_select_visible on public.posts for select to authenticated
  using (
    user_id = auth.uid() or (
      not hidden
      and not public.blocked_with_me(user_id)
      and (
        visibility = 'public'
        or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = posts.user_id)
      )
    )
  );
create policy posts_insert_own on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_update_own on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete_own on public.posts for delete to authenticated using (user_id = auth.uid());

revoke update on public.posts from anon, authenticated;
grant update (body, place_name, place_key, visibility, updated_at) on public.posts to authenticated;

create or replace function public.on_post_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.posts', 'user_id', new.user_id, interval '1 hour', 20, 'posts');
  if new.trip_id is not null and not exists (
    select 1 from public.trips where id = new.trip_id and user_id = new.user_id
  ) then
    raise exception 'You can only link your own trips';
  end if;
  if new.entry_id is not null and not exists (
    select 1 from public.entries where id = new.entry_id and user_id = new.user_id
  ) then
    raise exception 'You can only link your own journal entries';
  end if;
  -- Server-verified route: computed from the author's own GPS track, never trusted from the client.
  if new.include_route and new.trip_id is not null then
    new.route_km := public.trip_route_km(new.trip_id);
    new.route_preview := public.trip_route_preview(new.trip_id, 80);
  else
    new.include_route := false;
    new.route_km := null;
    new.route_preview := null;
  end if;
  -- Coarsen any attached coordinates (~100 m).
  new.latitude := round(new.latitude::numeric, 3);
  new.longitude := round(new.longitude::numeric, 3);
  new.like_count := 0;
  new.comment_count := 0;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.on_post_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.user_id;
    return new;
  end if;
  update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.on_post_before_insert();

drop trigger if exists posts_counts on public.posts;
create trigger posts_counts after insert or delete on public.posts
  for each row execute function public.on_post_change();

-- Likes ---------------------------------------------------------------------

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

drop policy if exists post_likes_select on public.post_likes;
drop policy if exists post_likes_insert_own on public.post_likes;
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_insert_own on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_delete_own on public.post_likes for delete to authenticated using (user_id = auth.uid());

revoke update on public.post_likes from anon, authenticated;

create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id returning user_id into v_author;
    perform public._notify(v_author, new.user_id, 'like', 'post', new.post_id);
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_likes_counts on public.post_likes;
create trigger post_likes_counts after insert or delete on public.post_likes
  for each row execute function public.on_like_change();

-- Comments ------------------------------------------------------------------

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_select on public.post_comments;
drop policy if exists post_comments_insert_own on public.post_comments;
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_select on public.post_comments for select to authenticated
  using (
    user_id = auth.uid() or (
      not hidden
      and not public.blocked_with_me(user_id)
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );
create policy post_comments_insert_own on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
-- Authors can delete their comment; post owners can remove comments on their post.
create policy post_comments_delete on public.post_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

revoke update on public.post_comments from anon, authenticated;

create or replace function public.on_comment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.post_comments', 'user_id', new.user_id, interval '10 minutes', 30, 'comments');
  new.body := trim(new.body);
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning user_id into v_author;
    perform public._notify(v_author, new.user_id, 'comment', 'post', new.post_id, new.body);
    return new;
  end if;
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists post_comments_before_insert on public.post_comments;
create trigger post_comments_before_insert before insert on public.post_comments
  for each row execute function public.on_comment_before_insert();

drop trigger if exists post_comments_counts on public.post_comments;
create trigger post_comments_counts after insert or delete on public.post_comments
  for each row execute function public.on_comment_change();

-- ===========================================================================
-- Reports (App Store 1.2: users can flag objectionable content; 3 reports auto-hide it)
-- ===========================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in (
    'post', 'comment', 'message', 'profile', 'tip', 'board_post', 'conversation'
  )),
  target_id uuid not null,
  reason text not null check (reason in (
    'spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'unsafe', 'impersonation', 'other'
  )),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_select_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());

revoke update, delete on public.reports from anon, authenticated;

create or replace function public.on_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hide_at constant int := 3;
begin
  perform public._enforce_rate_limit('public.reports', 'reporter_id', new.reporter_id, interval '1 hour', 30, 'reports');
  case new.target_type
    when 'post' then
      update public.posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'comment' then
      update public.post_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    else
      -- Connect tables (messages, tips, board posts, rooms) are handled in the connect migration.
      null;
  end case;
  return new;
end;
$$;

drop trigger if exists reports_apply on public.reports;
create trigger reports_apply after insert on public.reports
  for each row execute function public.on_report_created();

-- ===========================================================================
-- Storage: public avatars + post media (UUID paths, owner-folder writes)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists social_media_insert_own on storage.objects;
drop policy if exists social_media_update_own on storage.objects;
drop policy if exists social_media_delete_own on storage.objects;
drop policy if exists social_media_select_own on storage.objects;
create policy social_media_select_own on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_update_own on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);
create policy social_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'post-media') and auth.uid()::text = (storage.foldername(name))[1]);

-- ===========================================================================
-- Read models (security invoker: RLS above decides what each traveller can see)
-- ===========================================================================

create or replace function public.feed_page(
  p_mode text default 'following',
  p_place_key text default null,
  p_user uuid default null,
  p_before timestamptz default null,
  p_limit int default 20,
  p_offset int default 0,
  p_post uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  body text,
  trip_id uuid,
  place_name text,
  place_key text,
  latitude double precision,
  longitude double precision,
  visibility text,
  media jsonb,
  route_km numeric,
  route_preview jsonb,
  stats jsonb,
  like_count int,
  comment_count int,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  liked_by_me boolean,
  following_author boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.user_id, p.kind, p.body, p.trip_id, p.place_name, p.place_key, p.latitude, p.longitude,
    p.visibility, p.media, p.route_km, p.route_preview, p.stats, p.like_count, p.comment_count, p.created_at,
    pr.username, pr.display_name, pr.avatar_path, pr.tier,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id)
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where (p_before is null or p.created_at < p_before)
    and case p_mode
      when 'following' then
        p.user_id = auth.uid()
        or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id)
      when 'discover' then p.visibility = 'public'
      when 'trending' then p.visibility = 'public' and p.created_at > now() - interval '14 days'
      when 'place' then p.visibility = 'public' and p.place_key = p_place_key
      when 'user' then p.user_id = p_user
      when 'post' then p.id = p_post
      else false
    end
  order by
    case when p_mode = 'trending' then p.like_count * 2 + p.comment_count * 3 else 0 end desc,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.post_comments_page(p_post uuid, p_limit int default 200)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.post_id, c.user_id, c.body, c.created_at, pr.username, pr.display_name, pr.avatar_path, pr.tier
  from public.post_comments c
  join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
  order by c.created_at asc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

-- Public profile card, by id or by @username.
create or replace function public.get_profile(p_user uuid default null, p_username text default null)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_path text,
  home_region text,
  home_country text,
  travel_styles text[],
  languages text[],
  tier text,
  verified_km numeric,
  max_altitude_m numeric,
  trips_count int,
  followers_count int,
  following_count int,
  posts_count int,
  last_active_at timestamptz,
  created_at timestamptz,
  followed_by_me boolean,
  follows_me boolean,
  can_message boolean,
  is_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.username, p.display_name, p.bio, p.avatar_path, p.home_region, p.home_country,
    p.travel_styles, p.languages, p.tier, p.verified_km, p.max_altitude_m, p.trips_count,
    p.followers_count, p.following_count, p.posts_count, p.last_active_at, p.created_at,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = auth.uid()),
    p.id <> auth.uid() and (
      p.allow_messages = 'everyone'
      or (p.allow_messages = 'following'
          and exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = auth.uid()))
    ),
    p.id = auth.uid()
  from public.profiles p
  where (p_user is not null and p.id = p_user)
     or (p_user is null and p_username is not null and p.username = lower(p_username))
  limit 1
$$;

create or replace function public.search_travellers(p_query text, p_limit int default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  home_region text,
  travel_styles text[],
  followers_count int,
  followed_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, p.home_region, p.travel_styles, p.followers_count,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from public.profiles p
  where p.id <> auth.uid()
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and (
      p.is_discoverable
      or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
    )
    and (
      p.username ilike '%' || replace(replace(lower(trim(p_query)), '%', ''), '_', '\_') || '%'
      or p.display_name ilike '%' || replace(trim(p_query), '%', '') || '%'
    )
  order by (p.username = lower(trim(p_query))) desc, p.followers_count desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.suggested_travellers(p_limit int default 12)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  home_region text,
  travel_styles text[],
  followers_count int,
  shared_styles int
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select travel_styles, home_region from public.profiles where id = auth.uid()
  )
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, p.home_region, p.travel_styles, p.followers_count,
    (select count(*)::int from unnest(p.travel_styles) s where s = any (coalesce((select travel_styles from me), '{}'::text[])))
  from public.profiles p
  where p.id <> auth.uid()
    and p.is_discoverable
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  order by 9 desc, (p.home_region is not distinct from (select home_region from me)) desc,
    p.followers_count desc, p.last_active_at desc nulls last
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
$$;

create or replace function public.list_follows(
  p_user uuid,
  p_direction text default 'followers',
  p_before timestamptz default null,
  p_limit int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  followed_at timestamptz,
  followed_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.tier, f.created_at,
    exists (select 1 from public.follows mf where mf.follower_id = auth.uid() and mf.followee_id = p.id)
  from public.follows f
  join public.profiles p on p.id = case when p_direction = 'following' then f.followee_id else f.follower_id end
  where (case when p_direction = 'following' then f.follower_id else f.followee_id end) = p_user
    and (p_before is null or f.created_at < p_before)
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- The blocker still needs names to manage their block list (profiles RLS hides both ways).
create or replace function public.my_blocked_profiles()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;

create or replace function public.notifications_page(p_before timestamptz default null, p_limit int default 40)
returns table (
  id uuid,
  kind text,
  entity_type text,
  entity_id uuid,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_avatar_path text
)
language sql
stable
security invoker
set search_path = public
as $$
  select n.id, n.kind, n.entity_type, n.entity_id, n.body, n.read_at, n.created_at,
    n.actor_id, a.username, a.display_name, a.avatar_path
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.user_id = auth.uid() and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.feed_page(text, text, uuid, timestamptz, int, int, uuid)',
    'public.post_comments_page(uuid, int)',
    'public.get_profile(uuid, text)',
    'public.search_travellers(text, int)',
    'public.suggested_travellers(int)',
    'public.list_follows(uuid, text, timestamptz, int)',
    'public.notifications_page(timestamptz, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Trigger functions are never called directly.
revoke all on function public.on_follow_before_insert() from public, anon, authenticated;
revoke all on function public.on_follow_change() from public, anon, authenticated;
revoke all on function public.on_block_created() from public, anon, authenticated;
revoke all on function public.on_post_before_insert() from public, anon, authenticated;
revoke all on function public.on_post_change() from public, anon, authenticated;
revoke all on function public.on_like_change() from public, anon, authenticated;
revoke all on function public.on_comment_before_insert() from public, anon, authenticated;
revoke all on function public.on_comment_change() from public, anon, authenticated;
revoke all on function public.on_report_created() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Live notification badge.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
