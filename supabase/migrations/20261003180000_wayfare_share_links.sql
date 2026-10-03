-- Read-only trip sharing via unguessable share_id (RPC for anon)

alter table public.trips
  add column if not exists share_id text unique;

create index if not exists trips_share_id_idx on public.trips (share_id) where share_id is not null;

create or replace function public.get_shared_trip(p_share_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_share_id is null or length(p_share_id) < 8 then
    return null;
  end if;
  select json_build_object(
    'trip', row_to_json(t),
    'entries', coalesce(
      (select json_agg(row_to_json(e) order by e.recorded_at asc)
       from public.entries e
       where e.trip_id = t.id),
      '[]'::json
    )
  )
  into result
  from public.trips t
  where t.share_id = p_share_id
    and t.visibility = 'link'
  limit 1;
  return result;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
