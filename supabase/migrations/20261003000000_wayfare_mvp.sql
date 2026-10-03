-- Wayfare MVP schema (journal + utility). Social tables deferred.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  home_region text,
  tier text not null default 'traveler' check (tier in ('traveler', 'hardcore', 'legendary')),
  privacy_default text not null default 'private' check (privacy_default in ('private', 'link', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  trip_type text not null default 'trek',
  destination text,
  starts_on date,
  ends_on date,
  visibility text not null default 'private',
  companions text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  body text,
  mood text,
  place_name text,
  weather text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'other',
  amount numeric(12, 2) not null,
  currency text not null default 'INR',
  note text,
  spent_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  packed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.track_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  altitude_m double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists entries_trip_id_idx on public.entries (trip_id);
create index if not exists track_points_trip_id_idx on public.track_points (trip_id);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.entries enable row level security;
alter table public.expenses enable row level security;
alter table public.packing_items enable row level security;
alter table public.track_points enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

create policy trips_all_own on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy entries_all_own on public.entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy expenses_all_own on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy packing_all_own on public.packing_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy track_all_own on public.track_points for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
