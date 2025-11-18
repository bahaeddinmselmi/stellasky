-- RPC to link a friend by their share code
create or replace function public.link_friend(p_code text)
returns table(friend_user_id uuid, display_name text, share_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_friend uuid;
  v_a uuid;
  v_b uuid;
begin
  if v_me is null then
    raise exception 'unauthenticated';
  end if;

  select user_id into v_friend
  from public.user_settings
  where partner_share_code = p_code
  limit 1;

  if v_friend is null then
    raise exception 'friend not found';
  end if;
  if v_friend = v_me then
    raise exception 'cannot link yourself';
  end if;

  v_a := least(v_me, v_friend);
  v_b := greatest(v_me, v_friend);

  insert into public.friend_links(user_id_a, user_id_b)
  values (v_a, v_b)
  on conflict (user_id_a, user_id_b) do nothing;

  return query
  select u.user_id as friend_user_id,
         coalesce(u.partner_display_name, null) as display_name,
         u.partner_share_code as share_code
  from public.user_settings u
  where u.user_id = v_friend;
end;$$;

grant execute on function public.link_friend(text) to anon, authenticated, service_role;
comment on function public.link_friend(text) is 'Link current user with another user using their share code.';
