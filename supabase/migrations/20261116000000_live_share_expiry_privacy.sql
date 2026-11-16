-- Expired/revoked public links may describe their ended state, but must not expose location.
-- Preserve the RPC signature, JSON keys, owner RLS and one-day ended-link response window.
create or replace function public.get_live_share(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'label', s.label,
    'display_name', coalesce(p.display_name, p.username, 'A Wayfare traveller'),
    'latitude', case when s.expires_at > now() then s.latitude else null end,
    'longitude', case when s.expires_at > now() then s.longitude else null end,
    'accuracy_m', case when s.expires_at > now() then s.accuracy_m else null end,
    'updated_at', s.updated_at,
    'expires_at', s.expires_at,
    'active', s.expires_at > now()
  )
  from public.live_shares s
  join public.profiles p on p.id = s.user_id
  where s.id = p_id and s.expires_at > now() - interval '1 day'
$$;
revoke all on function public.get_live_share(uuid) from public;
grant execute on function public.get_live_share(uuid) to anon, authenticated;
