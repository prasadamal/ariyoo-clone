-- App health and growth, without third-party services.
--  * app_events: anonymous usage counts ("app_open", "moment_added"…) and JavaScript crash reports.
--    Write-only for the app; only the founder (service role / SQL editor) can read them.
--  * app_feedback: the "Send feedback" box in Settings. Write-only, same as above.
--  * trip_invites: "invite by link" for a journey's crew. The owner or an admin makes a link; anyone
--    signed in who opens it joins as a member until the link expires or is used up.

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  device_id text not null check (char_length(device_id) between 8 and 64),
  kind text not null check (kind in ('event', 'error')),
  name text not null check (char_length(name) between 1 and 80),
  detail text check (char_length(detail) <= 2000),
  app_version text check (char_length(app_version) <= 20),
  platform text check (char_length(platform) <= 20)
);
create index if not exists app_events_created_idx on public.app_events (created_at);
create index if not exists app_events_name_idx on public.app_events (kind, name);

alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;
grant insert (device_id, kind, name, detail, app_version, platform) on public.app_events to anon, authenticated;
drop policy if exists app_events_insert on public.app_events;
create policy app_events_insert on public.app_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create table if not exists public.app_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  device_id text not null check (char_length(device_id) between 8 and 64),
  message text not null check (char_length(message) between 1 and 4000),
  contact text check (char_length(contact) <= 200),
  app_version text check (char_length(app_version) <= 20),
  platform text check (char_length(platform) <= 20)
);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;
grant insert (device_id, message, contact, app_version, platform) on public.app_feedback to anon, authenticated;
drop policy if exists app_feedback_insert on public.app_feedback;
create policy app_feedback_insert on public.app_feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Weekly active devices and "still here a week later", for the launch rule (1 in 4 after a week).
create or replace view public.app_retention_weekly
with (security_invoker = true) as
with firsts as (
  select device_id, min(created_at) as first_seen from public.app_events where kind = 'event' group by device_id
)
select date_trunc('week', f.first_seen)::date as cohort_week,
       count(*) as new_devices,
       count(*) filter (where exists (
         select 1 from public.app_events e
         where e.device_id = f.device_id and e.kind = 'event'
           and e.created_at >= f.first_seen + interval '7 days'
           and e.created_at < f.first_seen + interval '14 days')) as active_in_week_2
from firsts f
group by 1
order by 1 desc;
revoke all on public.app_retention_weekly from anon, authenticated;

create table if not exists public.trip_invites (
  token text primary key check (char_length(token) between 16 and 64),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  uses_left int not null default 10 check (uses_left >= 0)
);
create index if not exists trip_invites_trip_idx on public.trip_invites (trip_id);
alter table public.trip_invites enable row level security;
revoke all on public.trip_invites from anon, authenticated;

-- Makes (or returns the live) invite link token for a journey. Owner or admin only.
create or replace function public.create_trip_invite(p_trip uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to invite people' using errcode = '28000';
  end if;
  if coalesce(public.trip_role(p_trip), '') not in ('owner', 'admin') then
    raise exception 'Only the owner or an admin can invite crew' using errcode = '42501';
  end if;
  select i.token into v_token from public.trip_invites i
   where i.trip_id = p_trip and i.expires_at > now() and i.uses_left > 0
   order by i.created_at desc limit 1;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into public.trip_invites (token, trip_id, created_by) values (v_token, p_trip, auth.uid());
  end if;
  return v_token;
end;
$$;
revoke all on function public.create_trip_invite(uuid) from public, anon;
grant execute on function public.create_trip_invite(uuid) to authenticated;

-- What an invite is for, before joining (title and who invited you). Null for a dead link.
create or replace function public.preview_trip_invite(p_token text)
returns table (trip_id uuid, title text, invited_by text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.title, coalesce(p.display_name, p.username, 'A traveller')
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token and i.expires_at > now() and i.uses_left > 0 and auth.uid() is not null
$$;
revoke all on function public.preview_trip_invite(text) from public, anon;
grant execute on function public.preview_trip_invite(text) to authenticated;

-- Joins the journey as a member. Already in it: nothing changes. Uses one use of the link.
create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_inv public.trip_invites%rowtype;
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'Sign in to join this journey' using errcode = '28000';
  end if;
  select * into v_inv from public.trip_invites where token = p_token for update;
  if not found or v_inv.expires_at <= now() or v_inv.uses_left <= 0 then
    raise exception 'This invite link has expired. Ask for a new one.' using errcode = 'P0002';
  end if;
  select t.user_id into v_owner from public.trips t where t.id = v_inv.trip_id;
  if public._blocked_between(v_me, v_inv.created_by) or public._blocked_between(v_me, v_owner) then
    raise exception 'This invite link has expired. Ask for a new one.' using errcode = 'P0002';
  end if;
  if v_owner = v_me or exists (select 1 from public.trip_members m where m.trip_id = v_inv.trip_id and m.user_id = v_me) then
    return v_inv.trip_id;
  end if;
  insert into public.trip_members (trip_id, user_id, role, added_by) values (v_inv.trip_id, v_me, 'member', v_inv.created_by);
  update public.trip_invites set uses_left = uses_left - 1 where token = p_token;
  return v_inv.trip_id;
end;
$$;
revoke all on function public.accept_trip_invite(text) from public, anon;
grant execute on function public.accept_trip_invite(text) to authenticated;
