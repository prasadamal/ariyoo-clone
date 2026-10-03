-- Baseline: the first schema that was applied to the hosted "wayfare" project.
-- Kept so that `supabase db reset` / a fresh project reaches the same history as
-- production. It is replaced by 20261004000000_wayfare_production_schema.sql,
-- which keeps only `public.treks` from this file.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  home_city text,
  created_at timestamptz not null default now()
);

create table if not exists public.treks (
  id serial primary key,
  name text not null unique,
  state text not null,
  max_altitude_m integer not null,
  days integer not null,
  difficulty text not null,
  best_months integer[] not null,
  signal_note text,
  permit_note text
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  trek_id integer references public.treks (id),
  title text not null,
  start_date date,
  days integer not null default 5,
  people integer not null default 1,
  style text not null default 'group' check (style in ('diy', 'group', 'private')),
  planned_budget numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  label text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pack_state (
  user_id uuid not null default auth.uid() references auth.users (id),
  item text not null,
  checked boolean not null default false,
  primary key (user_id, item)
);

alter table public.profiles enable row level security;
alter table public.treks enable row level security;
alter table public.trips enable row level security;
alter table public.expenses enable row level security;
alter table public.pack_state enable row level security;

create policy "own profile" on public.profiles for all
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "treks readable by all" on public.treks for select using (true);
create policy "own trips" on public.trips for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own expenses" on public.expenses for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own pack state" on public.pack_state for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.treks (name, state, max_altitude_m, days, difficulty, best_months, signal_note, permit_note) values
  ('Triund', 'Himachal', 2850, 2, 'Easy', '{1,2,3,4,5,6,9,10,11,12}', 'Patchy on the ridge, usually fine at the top', 'None usually'),
  ('Kedarkantha', 'Uttarakhand', 3810, 5, 'Easy–Moderate', '{12,1,2,3,4}', 'Only at Sankri base; none on trail', 'Forest fee at Sankri'),
  ('Brahmatal', 'Uttarakhand', 3796, 6, 'Moderate', '{12,1,2,3}', 'Lohajung only; none on trail', 'Forest fee'),
  ('Hampta Pass', 'Himachal', 4270, 5, 'Moderate', '{6,7,8,9}', 'Manali only; none after Jobra', 'Forest fee'),
  ('Valley of Flowers', 'Uttarakhand', 3658, 5, 'Easy–Moderate', '{7,8,9}', 'Some at Govindghat; weak at Ghangaria', 'Park entry ticket'),
  ('Sandakphu', 'West Bengal', 3636, 5, 'Moderate', '{3,4,5,10,11}', 'Better than most, spotty near villages', 'Park entry; guide rules apply'),
  ('Kashmir Great Lakes', 'J&K', 4200, 7, 'Moderate–Hard', '{7,8,9}', 'Sonamarg only', 'Forest fee; check local rules'),
  ('Stok Kangri', 'Ladakh', 6153, 8, 'Hard', '{7,8,9}', 'Leh only; none on route', 'Permit via registered operator')
on conflict (name) do nothing;
