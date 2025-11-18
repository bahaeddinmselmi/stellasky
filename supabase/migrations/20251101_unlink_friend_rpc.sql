-- RPC to unlink a friend by their user id
create or replace function public.unlink_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_me is null then
    raise exception 'unauthenticated';
  end if;
  if p_friend_id is null then
    raise exception 'friend id required';
  end if;
  if p_friend_id = v_me then
    return; -- nothing to do
  end if;

  v_a := least(v_me, p_friend_id);
  v_b := greatest(v_me, p_friend_id);

  delete from public.friend_links
  where user_id_a = v_a and user_id_b = v_b;
end;$$;

grant execute on function public.unlink_friend(uuid) to anon, authenticated, service_role;
comment on function public.unlink_friend(uuid) is 'Unlink current user from the specified friend user id.';
