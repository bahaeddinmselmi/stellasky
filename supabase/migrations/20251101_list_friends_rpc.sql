-- RPC to list current user's friends with display name and share code
create or replace function public.list_friends()
returns table(friend_user_id uuid, display_name text, share_code text)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ), pairs as (
    select case when f.user_id_a = (select id from me) then f.user_id_b else f.user_id_a end as friend_id
    from public.friend_links f
    where f.user_id_a = (select id from me) or f.user_id_b = (select id from me)
  )
  select u.user_id as friend_user_id,
         coalesce(u.partner_display_name, null) as display_name,
         u.partner_share_code as share_code
  from pairs p
  join public.user_settings u on u.user_id = p.friend_id
$$;

grant execute on function public.list_friends() to anon, authenticated, service_role;
comment on function public.list_friends() is 'List current user\'s friends (one row per friend).';
