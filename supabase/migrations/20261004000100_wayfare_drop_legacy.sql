-- Remove the empty prototype tables that 20261004000000 renamed aside.
-- Guarded: aborts if any of them somehow contains rows.
do $$
begin
  if to_regclass('public.legacy_trips') is not null then
    if exists (select 1 from public.legacy_trips limit 1)
       or exists (select 1 from public.legacy_expenses limit 1)
       or exists (select 1 from public.legacy_pack_state limit 1)
       or exists (select 1 from public.legacy_profiles limit 1) then
      raise exception 'Legacy tables contain data; refusing to drop';
    end if;
    drop table public.legacy_pack_state;
    drop table public.legacy_expenses;
    drop table public.legacy_trips;
    drop table public.legacy_profiles;
  end if;
end $$;
