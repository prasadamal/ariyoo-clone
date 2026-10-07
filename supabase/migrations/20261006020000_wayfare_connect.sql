-- Wayfare Connect: chats (direct, crew groups, destination rooms), the travel board
-- (buddies / meetups / ride shares / stay shares), place tips, opt-in nearby presence
-- and "who's going where you're going" trip matching.

-- ===========================================================================
-- Conversations
-- ===========================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group', 'place')),
  title text check (title is null or char_length(title) <= 80),
  place_key text check (place_key is null or place_key ~ '^[a-z0-9-]{2,60}$'),
  direct_key text unique,
  trip_id uuid,
  board_post_id uuid,
  invite_code text unique,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  member_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists conversations_place_room_idx on public.conversations (place_key) where kind = 'place';
create index if not exists conversations_last_msg_idx on public.conversations (last_message_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'location', 'system')),
  body text check (body is null or char_length(body) <= 4000),
  media_path text,
  latitude double precision,
  longitude double precision,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    coalesce(char_length(trim(body)), 0) > 0
    or media_path is not null
    or (latitude is not null and longitude is not null)
  )
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = auth.uid()
  )
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated
  using (kind = 'place' or public.is_conversation_member(id));

-- Conversations are created / changed only through the RPCs below.
revoke insert, update, delete on public.conversations from anon, authenticated;

drop policy if exists conversation_members_select on public.conversation_members;
drop policy if exists conversation_members_update_own on public.conversation_members;
drop policy if exists conversation_members_delete_own on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy conversation_members_update_own on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conversation_members_delete_own on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());

revoke insert, update on public.conversation_members from anon, authenticated;
grant update (last_read_at, muted) on public.conversation_members to authenticated;

drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete_own on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and (sender_id = auth.uid() or (not hidden and not public.blocked_with_me(sender_id)))
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind <> 'system'
    and public.is_conversation_member(conversation_id)
  );
create policy messages_delete_own on public.messages for delete to authenticated using (sender_id = auth.uid());

revoke update on public.messages from anon, authenticated;

create or replace function public.on_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  if new.kind <> 'system' then
    perform public._enforce_rate_limit('public.messages', 'sender_id', new.sender_id, interval '1 minute', 30, 'messages');
    select * into v_conv from public.conversations where id = new.conversation_id;
    -- Check both participants of a direct chat, even one who left it.
    if v_conv.kind = 'direct' and exists (
      select 1 from unnest(string_to_array(v_conv.direct_key, ':')) as u
      where u::uuid <> new.sender_id and public._blocked_between(u::uuid, new.sender_id)
    ) then
      raise exception 'You cannot message this traveller';
    end if;
  end if;
  if new.kind = 'location' then
    new.latitude := round(new.latitude::numeric, 4);
    new.longitude := round(new.longitude::numeric, 4);
  end if;
  new.body := nullif(trim(new.body), '');
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  -- Leaving a direct chat hides it; a new message brings it back for both sides.
  if v_conv.kind = 'direct' and v_conv.direct_key is not null then
    insert into public.conversation_members (conversation_id, user_id, last_read_at)
    select new.conversation_id, u::uuid, new.created_at - interval '1 second'
    from unnest(string_to_array(v_conv.direct_key, ':')) as u
    where exists (select 1 from public.profiles p where p.id = u::uuid)
    on conflict do nothing;
  end if;
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(case new.kind
        when 'image' then '📷 Photo'
        when 'location' then '📍 Location'
        else coalesce(new.body, '')
      end, 140)
  where id = new.conversation_id;
  update public.conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.on_message_before_insert();

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_inserted();

-- Keeps member counts, hands a group to the next member when its owner leaves (or deletes
-- their account) and removes groups nobody is left in.
create or replace function public.on_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_next uuid;
begin
  if tg_op = 'INSERT' then
    update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
    return new;
  end if;
  update public.conversations set member_count = greatest(member_count - 1, 0)
  where id = old.conversation_id
  returning kind into v_kind;
  if v_kind = 'group' then
    if not exists (select 1 from public.conversation_members where conversation_id = old.conversation_id) then
      delete from public.conversations where id = old.conversation_id;
    elsif old.role = 'owner' and not exists (
      select 1 from public.conversation_members where conversation_id = old.conversation_id and role = 'owner'
    ) then
      select user_id into v_next from public.conversation_members
      where conversation_id = old.conversation_id
      order by (role = 'admin') desc, joined_at asc
      limit 1;
      update public.conversation_members set role = 'owner'
      where conversation_id = old.conversation_id and user_id = v_next;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists conversation_members_count on public.conversation_members;
create trigger conversation_members_count after insert or delete on public.conversation_members
  for each row execute function public.on_member_change();

-- Private chat photos: <conversation_id>/<uuid>.jpg, readable by members only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path-safe membership check (no uuid cast errors on unexpected object names).
create or replace function public.is_conversation_member_path(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text := split_part(p_name, '/', 1);
begin
  if p_bucket <> 'chat-media' or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(folder::uuid);
end;
$$;

revoke all on function public.is_conversation_member_path(text, text) from public, anon;
grant execute on function public.is_conversation_member_path(text, text) to authenticated;

drop policy if exists chat_media_select_member on storage.objects;
drop policy if exists chat_media_insert_member on storage.objects;
create policy chat_media_select_member on storage.objects for select to authenticated
  using (public.is_conversation_member_path(bucket_id, name));
create policy chat_media_insert_member on storage.objects for insert to authenticated
  with check (public.is_conversation_member_path(bucket_id, name));

-- Helpers ----------------------------------------------------------------------

create or replace function public._new_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  code text;
begin
  loop
    -- md5 hex minus 0/1 -> 14 unambiguous symbols; avoids pgcrypto (lives in `extensions` on Supabase).
    code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 8));
    exit when char_length(code) = 8 and not exists (select 1 from public.conversations where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public._system_message(p_conversation uuid, p_actor uuid, p_body text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.messages (conversation_id, sender_id, kind, body) values (p_conversation, p_actor, 'system', p_body);
$$;

create or replace function public._can_message(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_sender <> p_recipient
    and not public._blocked_between(p_sender, p_recipient)
    and exists (
      select 1 from public.profiles p
      where p.id = p_recipient
        and (
          p.allow_messages = 'everyone'
          or (p.allow_messages = 'following'
              and exists (select 1 from public.follows f where f.follower_id = p_recipient and f.followee_id = p_sender))
        )
    )
$$;

revoke all on function public._new_invite_code() from public, anon, authenticated;
revoke all on function public._system_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._can_message(uuid, uuid) from public, anon, authenticated;

-- RPCs -------------------------------------------------------------------------

create or replace function public.start_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_key text;
  v_id uuid;
  v_policy text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_other is null or p_other = me then
    raise exception 'Pick another traveller to message';
  end if;
  if public._blocked_between(me, p_other) then
    raise exception 'You cannot message this traveller';
  end if;
  select allow_messages into v_policy from public.profiles where id = p_other;
  if not found then
    raise exception 'Traveller not found';
  end if;
  v_key := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is null then
    if not public._can_message(me, p_other) then
      if v_policy = 'none' then
        raise exception 'This traveller is not accepting messages';
      end if;
      raise exception 'This traveller only accepts messages from people they follow';
    end if;
    insert into public.conversations (kind, direct_key, created_by) values ('direct', v_key, me) returning id into v_id;
  end if;
  -- (Re)join both sides: leaving a direct chat only hides it until the next message.
  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, me, 'member'), (v_id, p_other, 'member')
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[] default '{}',
  p_trip_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_member uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Give your crew chat a name';
  end if;
  perform public._enforce_rate_limit('public.conversations', 'created_by', me, interval '1 day', 20, 'group chats');
  insert into public.conversations (kind, title, trip_id, invite_code, created_by)
  values ('group', left(trim(p_title), 80), p_trip_id, public._new_invite_code(), me)
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, role) values (v_id, me, 'owner');
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if public._can_message(me, v_member) then
      insert into public.conversation_members (conversation_id, user_id) values (v_id, v_member) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.join_conversation_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_conv public.conversations;
  v_name text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select * into v_conv from public.conversations where invite_code = upper(trim(p_code)) and kind = 'group';
  if not found then
    raise exception 'That invite code is not valid';
  end if;
  if public._blocked_between(me, v_conv.created_by) then
    raise exception 'That invite code is not valid';
  end if;
  if v_conv.member_count >= 100 then
    raise exception 'This crew is full';
  end if;
  if not exists (select 1 from public.conversation_members where conversation_id = v_conv.id and user_id = me) then
    insert into public.conversation_members (conversation_id, user_id) values (v_conv.id, me);
    select coalesce(display_name, username, 'A traveller') into v_name from public.profiles where id = me;
    perform public._system_message(v_conv.id, me, v_name || ' joined the crew');
    perform public._notify(v_conv.created_by, me, 'crew_join', 'conversation', v_conv.id, v_conv.title);
  end if;
  return v_conv.id;
end;
$$;

create or replace function public.join_place_room(p_place_key text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_place_key !~ '^[a-z0-9-]{2,60}$' then
    raise exception 'Invalid place';
  end if;
  select id into v_id from public.conversations where kind = 'place' and place_key = p_place_key;
  if v_id is null then
    insert into public.conversations (kind, title, place_key, created_by)
    values ('place', left(coalesce(nullif(trim(p_title), ''), p_place_key), 80), p_place_key, me)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where kind = 'place' and place_key = p_place_key;
    end if;
  end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, me) on conflict do nothing;
  return v_id;
end;
$$;

-- Leaving a group hands ownership on (see on_member_change); leaving a direct chat hides it.
create or replace function public.leave_conversation(p_conversation uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.conversation_members where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.remove_conversation_member(p_conversation uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation and m.user_id = auth.uid()
      and m.role in ('owner', 'admin') and c.kind = 'group'
  ) then
    raise exception 'Only crew admins can remove members';
  end if;
  if p_user = auth.uid() then
    raise exception 'Use leave instead';
  end if;
  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = p_user and role <> 'owner';
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.my_conversations()
returns table (
  id uuid,
  kind text,
  title text,
  place_key text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz,
  member_count int,
  muted boolean,
  role text,
  unread_count int,
  invite_code text,
  trip_id uuid,
  board_post_id uuid,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.kind, c.title, c.place_key, c.last_message_at, c.last_message_preview, c.created_at, c.member_count,
    m.muted, m.role,
    (select count(*)::int from public.messages msg
      where msg.conversation_id = c.id and msg.created_at > m.last_read_at and msg.sender_id <> auth.uid()),
    c.invite_code, c.trip_id, c.board_post_id,
    o.user_id, op.username, op.display_name, op.avatar_path
  from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  left join lateral (
    select om.user_id from public.conversation_members om
    where om.conversation_id = c.id and om.user_id <> auth.uid() and c.kind = 'direct'
    limit 1
  ) o on true
  left join public.profiles op on op.id = o.user_id
  where m.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

create or replace function public.conversation_members_list(p_conversation uuid)
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  username text,
  display_name text,
  avatar_path text,
  tier text
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.user_id, m.role, m.joined_at, p.username, p.display_name, p.avatar_path, p.tier
  from public.conversation_members m
  left join public.profiles p on p.id = m.user_id
  where m.conversation_id = p_conversation
  order by (m.role = 'owner') desc, m.joined_at asc
  limit 500
$$;

create or replace function public.conversation_messages(
  p_conversation uuid,
  p_before timestamptz default null,
  p_limit int default 50
)
returns setof public.messages
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.messages
  where conversation_id = p_conversation and (p_before is null or created_at < p_before)
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

create or replace function public.place_rooms(p_query text default null, p_limit int default 30)
returns table (
  id uuid,
  title text,
  place_key text,
  member_count int,
  last_message_at timestamptz,
  last_message_preview text,
  joined boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.title, c.place_key, c.member_count, c.last_message_at,
    case when public.is_conversation_member(c.id) then c.last_message_preview end,
    public.is_conversation_member(c.id)
  from public.conversations c
  where c.kind = 'place'
    and (
      p_query is null or char_length(trim(p_query)) = 0
      or c.title ilike '%' || replace(trim(p_query), '%', '') || '%'
      or c.place_key ilike '%' || replace(trim(p_query), '%', '') || '%'
    )
  order by c.member_count desc, c.last_message_at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- ===========================================================================
-- Travel board: buddies, meetups, ride shares, stay shares
-- ===========================================================================

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('buddy', 'meetup', 'ride', 'stay')),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text check (body is null or char_length(body) <= 2000),
  place_name text not null check (char_length(trim(place_name)) between 2 and 120),
  place_key text not null check (place_key ~ '^[a-z0-9-]{2,60}$'),
  starts_on date,
  ends_on date,
  meet_at timestamptz,
  spots int not null default 1 check (spots between 1 and 50),
  budget_level text check (budget_level is null or budget_level in ('shoestring', 'moderate', 'comfort')),
  status text not null default 'open' check (status in ('open', 'full', 'closed')),
  accepted_count int not null default 0,
  pending_count int not null default 0,
  conversation_id uuid references public.conversations (id) on delete set null,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists board_posts_created_idx on public.board_posts (created_at desc);
create index if not exists board_posts_place_idx on public.board_posts (place_key, created_at desc);

do $$
begin
  alter table public.conversations
    add constraint conversations_board_post_fk foreign key (board_post_id)
    references public.board_posts (id) on delete set null;
exception when duplicate_object then null;
end $$;

alter table public.board_posts enable row level security;

drop policy if exists board_posts_select on public.board_posts;
drop policy if exists board_posts_insert_own on public.board_posts;
drop policy if exists board_posts_update_own on public.board_posts;
drop policy if exists board_posts_delete_own on public.board_posts;
create policy board_posts_select on public.board_posts for select to authenticated
  using (user_id = auth.uid() or (not hidden and not public.blocked_with_me(user_id)));
create policy board_posts_insert_own on public.board_posts for insert to authenticated with check (user_id = auth.uid());
create policy board_posts_update_own on public.board_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy board_posts_delete_own on public.board_posts for delete to authenticated using (user_id = auth.uid());

revoke update on public.board_posts from anon, authenticated;
grant update (title, body, place_name, place_key, starts_on, ends_on, meet_at, spots, budget_level, status, updated_at)
  on public.board_posts to authenticated;

create or replace function public.on_board_post_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.board_posts', 'user_id', new.user_id, interval '1 day', 10, 'board posts');
  new.title := trim(new.title);
  new.status := 'open';
  new.accepted_count := 0;
  new.pending_count := 0;
  new.conversation_id := null;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists board_posts_before_insert on public.board_posts;
create trigger board_posts_before_insert before insert on public.board_posts
  for each row execute function public.on_board_post_before_insert();

create table if not exists public.board_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists board_requests_post_idx on public.board_requests (post_id, created_at);

alter table public.board_requests enable row level security;

drop policy if exists board_requests_select on public.board_requests;
drop policy if exists board_requests_insert_own on public.board_requests;
drop policy if exists board_requests_delete_own on public.board_requests;
create policy board_requests_select on public.board_requests for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.board_posts b where b.id = post_id and b.user_id = auth.uid())
  );
create policy board_requests_insert_own on public.board_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.board_posts b
      where b.id = post_id and b.status = 'open' and b.user_id <> auth.uid()
        and not b.hidden and not public.blocked_with_me(b.user_id)
    )
  );
-- Withdraw a pending request.
create policy board_requests_delete_own on public.board_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

revoke update on public.board_requests from anon, authenticated;

create or replace function public.on_board_request_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.board_requests', 'user_id', new.user_id, interval '1 hour', 30, 'requests');
  new.status := 'pending';
  new.message := nullif(trim(new.message), '');
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.on_board_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  if tg_op = 'INSERT' then
    update public.board_posts set pending_count = pending_count + 1 where id = new.post_id
    returning user_id, title into v_owner, v_title;
    perform public._notify(v_owner, new.user_id, 'board_request', 'board_post', new.post_id, v_title);
    return new;
  end if;
  if old.status = 'pending' then
    update public.board_posts set pending_count = greatest(pending_count - 1, 0) where id = old.post_id;
  end if;
  return old;
end;
$$;

drop trigger if exists board_requests_before_insert on public.board_requests;
create trigger board_requests_before_insert before insert on public.board_requests
  for each row execute function public.on_board_request_before_insert();

drop trigger if exists board_requests_counts on public.board_requests;
create trigger board_requests_counts after insert or delete on public.board_requests
  for each row execute function public.on_board_request_change();

-- Accept (adds the traveller to the crew chat) or decline a join request.
create or replace function public.respond_board_request(p_request uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_req public.board_requests;
  v_post public.board_posts;
  v_conv uuid;
  v_name text;
begin
  select * into v_req from public.board_requests where id = p_request for update;
  if not found then
    raise exception 'Request not found';
  end if;
  select * into v_post from public.board_posts where id = v_req.post_id for update;
  if v_post.user_id is distinct from me then
    raise exception 'Only the organiser can respond';
  end if;
  if v_req.status <> 'pending' then
    return v_post.conversation_id;
  end if;

  if not p_accept then
    update public.board_requests set status = 'declined', updated_at = now() where id = p_request;
    update public.board_posts set pending_count = greatest(pending_count - 1, 0) where id = v_post.id;
    perform public._notify(v_req.user_id, me, 'board_declined', 'board_post', v_post.id, v_post.title);
    return null;
  end if;

  if v_post.accepted_count >= v_post.spots then
    raise exception 'No spots left — increase spots to accept more travellers';
  end if;
  if public._blocked_between(me, v_req.user_id) then
    raise exception 'You cannot add this traveller';
  end if;

  v_conv := v_post.conversation_id;
  if v_conv is null then
    insert into public.conversations (kind, title, board_post_id, invite_code, created_by)
    values ('group', left(v_post.title, 80), v_post.id, public._new_invite_code(), me)
    returning id into v_conv;
    insert into public.conversation_members (conversation_id, user_id, role) values (v_conv, me, 'owner');
  end if;

  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_req.user_id)
  on conflict do nothing;
  select coalesce(display_name, username, 'A traveller') into v_name from public.profiles where id = v_req.user_id;
  perform public._system_message(v_conv, v_req.user_id, v_name || ' joined the crew');

  update public.board_requests set status = 'accepted', updated_at = now() where id = p_request;
  update public.board_posts
  set accepted_count = accepted_count + 1,
      pending_count = greatest(pending_count - 1, 0),
      conversation_id = v_conv,
      status = case when accepted_count + 1 >= spots then 'full' else status end,
      updated_at = now()
  where id = v_post.id;

  perform public._notify(v_req.user_id, me, 'board_accepted', 'board_post', v_post.id, v_post.title);
  return v_conv;
end;
$$;

create or replace function public.board_page(
  p_kind text default null,
  p_place_key text default null,
  p_mine boolean default false,
  p_before timestamptz default null,
  p_limit int default 20,
  p_post uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  title text,
  body text,
  place_name text,
  place_key text,
  starts_on date,
  ends_on date,
  meet_at timestamptz,
  spots int,
  budget_level text,
  status text,
  accepted_count int,
  pending_count int,
  conversation_id uuid,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  my_request_status text
)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id, b.user_id, b.kind, b.title, b.body, b.place_name, b.place_key, b.starts_on, b.ends_on, b.meet_at,
    b.spots, b.budget_level, b.status, b.accepted_count,
    case when b.user_id = auth.uid() then b.pending_count else 0 end,
    case when b.user_id = auth.uid()
           or exists (select 1 from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid() and r.status = 'accepted')
         then b.conversation_id end,
    b.created_at, pr.username, pr.display_name, pr.avatar_path, pr.tier,
    (select r.status from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid())
  from public.board_posts b
  join public.profiles pr on pr.id = b.user_id
  where (p_post is not null and b.id = p_post)
    or (
      p_post is null
      and (p_kind is null or b.kind = p_kind)
      and (p_place_key is null or b.place_key = p_place_key)
      and (p_before is null or b.created_at < p_before)
      and (
        (p_mine and (
          b.user_id = auth.uid()
          or exists (select 1 from public.board_requests r where r.post_id = b.id and r.user_id = auth.uid())
        ))
        or (not p_mine
          and b.status <> 'closed'
          and coalesce(b.ends_on, b.starts_on, (b.meet_at at time zone 'utc')::date, current_date) >= current_date - 1)
      )
    )
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.board_requests_for_post(p_post uuid)
returns table (
  id uuid,
  user_id uuid,
  message text,
  status text,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, r.user_id, r.message, r.status, r.created_at, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles
  from public.board_requests r
  join public.profiles p on p.id = r.user_id
  where r.post_id = p_post
  order by (r.status = 'pending') desc, r.created_at asc
$$;

-- ===========================================================================
-- Place tips (community knowledge per destination)
-- ===========================================================================

create table if not exists public.place_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_key text not null check (place_key ~ '^[a-z0-9-]{2,60}$'),
  place_name text,
  category text not null default 'general' check (category in (
    'general', 'stay', 'food', 'water', 'transport', 'permit', 'safety', 'gear', 'connectivity', 'money'
  )),
  body text not null check (char_length(trim(body)) between 3 and 1000),
  upvotes int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists place_tips_place_idx on public.place_tips (place_key, upvotes desc, created_at desc);

create table if not exists public.place_tip_votes (
  tip_id uuid not null references public.place_tips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);

alter table public.place_tips enable row level security;
alter table public.place_tip_votes enable row level security;

drop policy if exists place_tips_select on public.place_tips;
drop policy if exists place_tips_insert_own on public.place_tips;
drop policy if exists place_tips_delete_own on public.place_tips;
create policy place_tips_select on public.place_tips for select to authenticated
  using (user_id = auth.uid() or (not hidden and not public.blocked_with_me(user_id)));
create policy place_tips_insert_own on public.place_tips for insert to authenticated with check (user_id = auth.uid());
create policy place_tips_delete_own on public.place_tips for delete to authenticated using (user_id = auth.uid());

revoke update on public.place_tips from anon, authenticated;

drop policy if exists place_tip_votes_select on public.place_tip_votes;
drop policy if exists place_tip_votes_insert_own on public.place_tip_votes;
drop policy if exists place_tip_votes_delete_own on public.place_tip_votes;
create policy place_tip_votes_select on public.place_tip_votes for select to authenticated using (user_id = auth.uid());
create policy place_tip_votes_insert_own on public.place_tip_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.place_tips t where t.id = tip_id and t.user_id <> auth.uid())
  );
create policy place_tip_votes_delete_own on public.place_tip_votes for delete to authenticated using (user_id = auth.uid());

revoke update on public.place_tip_votes from anon, authenticated;

create or replace function public.on_tip_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._enforce_rate_limit('public.place_tips', 'user_id', new.user_id, interval '1 day', 30, 'tips');
  new.body := trim(new.body);
  new.upvotes := 0;
  new.report_count := 0;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.on_tip_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_place text;
begin
  if tg_op = 'INSERT' then
    update public.place_tips set upvotes = upvotes + 1 where id = new.tip_id returning user_id, place_name into v_author, v_place;
    perform public._notify(v_author, new.user_id, 'tip_upvote', 'tip', new.tip_id, v_place);
    return new;
  end if;
  update public.place_tips set upvotes = greatest(upvotes - 1, 0) where id = old.tip_id;
  return old;
end;
$$;

drop trigger if exists place_tips_before_insert on public.place_tips;
create trigger place_tips_before_insert before insert on public.place_tips
  for each row execute function public.on_tip_before_insert();

drop trigger if exists place_tip_votes_counts on public.place_tip_votes;
create trigger place_tip_votes_counts after insert or delete on public.place_tip_votes
  for each row execute function public.on_tip_vote_change();

create or replace function public.place_tips_page(p_place_key text, p_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  place_key text,
  category text,
  body text,
  upvotes int,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_tier text,
  voted_by_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.user_id, t.place_key, t.category, t.body, t.upvotes, t.created_at,
    p.username, p.display_name, p.avatar_path, p.tier,
    exists (select 1 from public.place_tip_votes v where v.tip_id = t.id and v.user_id = auth.uid())
  from public.place_tips t
  join public.profiles p on p.id = t.user_id
  where t.place_key = p_place_key
  order by t.upvotes desc, t.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- ===========================================================================
-- Nearby travellers (opt-in, coarse ~1 km grid, expires, reciprocal)
-- ===========================================================================

create table if not exists public.presence (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  lat_coarse double precision not null check (lat_coarse between -90 and 90),
  lng_coarse double precision not null check (lng_coarse between -180 and 180),
  place_label text check (place_label is null or char_length(place_label) <= 80),
  status_text text check (status_text is null or char_length(status_text) <= 140),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);

create index if not exists presence_expires_idx on public.presence (expires_at);

alter table public.presence enable row level security;

drop policy if exists presence_own on public.presence;
create policy presence_own on public.presence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.on_presence_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.lat_coarse := round(new.lat_coarse::numeric, 2);
  new.lng_coarse := round(new.lng_coarse::numeric, 2);
  new.updated_at := now();
  new.expires_at := least(greatest(new.expires_at, now() + interval '15 minutes'), now() + interval '24 hours');
  return new;
end;
$$;

drop trigger if exists presence_coarsen on public.presence;
create trigger presence_coarsen before insert or update on public.presence
  for each row execute function public.on_presence_write();

create or replace function public._km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select public._haversine_m(lat1, lng1, lat2, lng2) / 1000.0
$$;

create or replace function public.nearby_travellers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 25,
  p_limit int default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[],
  place_label text,
  status_text text,
  distance_km int,
  updated_at timestamptz,
  followed_by_me boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_radius double precision := least(greatest(coalesce(p_radius_km, 25), 1), 100);
  v_lat double precision := round(p_lat::numeric, 2);
  v_lng double precision := round(p_lng::numeric, 2);
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.presence where presence.user_id = me and expires_at > now()) then
    raise exception 'Turn on nearby visibility to see travellers around you';
  end if;
  return query
  select pr.user_id, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles,
    pr.place_label, pr.status_text,
    greatest(1, round(public._km_between(v_lat, v_lng, pr.lat_coarse, pr.lng_coarse)))::int,
    pr.updated_at,
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = pr.user_id)
  from public.presence pr
  join public.profiles p on p.id = pr.user_id
  where pr.user_id <> me
    and pr.expires_at > now()
    and p.is_discoverable
    and not public._blocked_between(me, pr.user_id)
    and pr.lat_coarse between v_lat - v_radius / 111.0 and v_lat + v_radius / 111.0
    and public._km_between(v_lat, v_lng, pr.lat_coarse, pr.lng_coarse) <= v_radius
  order by 9 asc, pr.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- ===========================================================================
-- Trip matching: travellers heading to the same place around the same dates
-- ===========================================================================

create table if not exists public.trip_match_notices (
  trip_a uuid not null,
  trip_b uuid not null,
  created_at timestamptz not null default now(),
  primary key (trip_a, trip_b)
);

alter table public.trip_match_notices enable row level security;
revoke all on public.trip_match_notices from anon, authenticated;

create or replace function public._trip_overlap_days(
  a_start date, a_end date, b_start date, b_end date, p_slack int default 3
)
returns int
language sql
immutable
as $$
  select case
    when a_start is null or b_start is null then null
    when daterange(a_start - p_slack, coalesce(a_end, a_start) + p_slack, '[]')
         && daterange(b_start, coalesce(b_end, b_start), '[]')
      then greatest(0, least(coalesce(a_end, a_start), coalesce(b_end, b_start)) - greatest(a_start, b_start) + 1)
    else null
  end
$$;

create or replace function public.find_trip_matches(p_trip uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  travel_styles text[],
  destination text,
  starts_on date,
  ends_on date,
  overlap_days int,
  followed_by_me boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_trip public.trips;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select * into v_trip from public.trips where id = p_trip and trips.user_id = me;
  if not found then
    raise exception 'Trip not found — sync it first';
  end if;
  -- Reciprocal: you only see others while your own trip is open to meet.
  if not v_trip.open_to_meet or v_trip.place_key is null or v_trip.starts_on is null then
    return;
  end if;
  return query
  select t.user_id, p.username, p.display_name, p.avatar_path, p.tier, p.travel_styles, t.destination,
    t.starts_on, t.ends_on,
    public._trip_overlap_days(v_trip.starts_on, v_trip.ends_on, t.starts_on, t.ends_on, 3),
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = t.user_id)
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.user_id <> me
    and t.open_to_meet
    and t.place_key = v_trip.place_key
    and t.status <> 'cancelled'
    and p.is_discoverable
    and coalesce(t.ends_on, t.starts_on) >= current_date
    and public._trip_overlap_days(v_trip.starts_on, v_trip.ends_on, t.starts_on, t.ends_on, 3) is not null
    and not public._blocked_between(me, t.user_id)
  order by 10 desc, p.followers_count desc
  limit 50;
end;
$$;

create or replace function public.travellers_heading_to(
  p_place_key text,
  p_from date default current_date,
  p_to date default current_date + 120,
  p_limit int default 30
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  tier text,
  starts_on date,
  ends_on date,
  followed_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (t.user_id)
    t.user_id, p.username, p.display_name, p.avatar_path, p.tier, t.starts_on, t.ends_on,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = t.user_id)
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where auth.uid() is not null
    and t.place_key = p_place_key
    and t.open_to_meet
    and t.status <> 'cancelled'
    and t.starts_on is not null
    and p.is_discoverable
    and daterange(t.starts_on, coalesce(t.ends_on, t.starts_on), '[]') && daterange(p_from, p_to, '[]')
    and not public._blocked_between(auth.uid(), t.user_id)
  order by t.user_id, t.starts_on
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- Notify both sides once when a trip newly matches another (network effect, rate-limited).
create or replace function public.on_trip_match_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not new.open_to_meet or new.place_key is null or new.starts_on is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.open_to_meet
     and old.place_key is not distinct from new.place_key
     and old.starts_on is not distinct from new.starts_on
     and old.ends_on is not distinct from new.ends_on then
    return new;
  end if;
  if coalesce(new.ends_on, new.starts_on) < current_date then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and is_discoverable) then
    return new;
  end if;
  for r in
    select t.id, t.user_id
    from public.trips t
    join public.profiles p on p.id = t.user_id
    where t.id <> new.id
      and t.user_id <> new.user_id
      and t.open_to_meet
      and t.place_key = new.place_key
      and t.status <> 'cancelled'
      and p.is_discoverable
      and coalesce(t.ends_on, t.starts_on) >= current_date
      and public._trip_overlap_days(new.starts_on, new.ends_on, t.starts_on, t.ends_on, 3) is not null
      and not exists (
        select 1 from public.trip_match_notices n
        where n.trip_a = least(t.id, new.id) and n.trip_b = greatest(t.id, new.id)
      )
    limit 25
  loop
    insert into public.trip_match_notices (trip_a, trip_b) values (least(r.id, new.id), greatest(r.id, new.id))
    on conflict do nothing;
    perform public._notify(r.user_id, new.user_id, 'trip_match', 'trip', r.id, coalesce(new.destination, new.place_key));
    perform public._notify(new.user_id, r.user_id, 'trip_match', 'trip', new.id, coalesce(new.destination, new.place_key));
  end loop;
  return new;
end;
$$;

drop trigger if exists trips_match_notify on public.trips;
create trigger trips_match_notify after insert or update of open_to_meet, place_key, starts_on, ends_on on public.trips
  for each row execute function public.on_trip_match_candidate();

-- ===========================================================================
-- Reports now also cover Connect content.
-- ===========================================================================

create or replace function public.on_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hide_at constant int := 3;
begin
  perform public._enforce_rate_limit('public.reports', 'reporter_id', new.reporter_id, interval '1 hour', 31, 'reports');
  case new.target_type
    when 'post' then
      update public.posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'comment' then
      update public.post_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'message' then
      update public.messages set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'tip' then
      update public.place_tips set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'board_post' then
      update public.board_posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= hide_at
      where id = new.target_id;
    when 'conversation' then
      update public.conversations set report_count = report_count + 1 where id = new.target_id;
    else
      null;
  end case;
  return new;
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.start_direct_conversation(uuid)',
    'public.create_group_conversation(text, uuid[], uuid)',
    'public.join_conversation_by_code(text)',
    'public.join_place_room(text, text)',
    'public.leave_conversation(uuid)',
    'public.remove_conversation_member(uuid, uuid)',
    'public.mark_conversation_read(uuid)',
    'public.my_conversations()',
    'public.conversation_members_list(uuid)',
    'public.conversation_messages(uuid, timestamptz, int)',
    'public.place_rooms(text, int)',
    'public.respond_board_request(uuid, boolean)',
    'public.board_page(text, text, boolean, timestamptz, int, uuid)',
    'public.board_requests_for_post(uuid)',
    'public.place_tips_page(text, int)',
    'public.nearby_travellers(double precision, double precision, double precision, int)',
    'public.find_trip_matches(uuid)',
    'public.travellers_heading_to(text, date, date, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array array[
    'public.on_message_before_insert()',
    'public.on_message_inserted()',
    'public.on_member_change()',
    'public.on_board_post_before_insert()',
    'public.on_board_request_before_insert()',
    'public.on_board_request_change()',
    'public.on_tip_before_insert()',
    'public.on_tip_vote_change()',
    'public.on_presence_write()',
    'public.on_trip_match_candidate()',
    'public.on_report_created()',
    'public._km_between(double precision, double precision, double precision, double precision)',
    'public._trip_overlap_days(date, date, date, date, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- Realtime chat.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
