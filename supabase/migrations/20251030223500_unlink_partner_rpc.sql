-- Securely unlink partners (both sides) for the current user
create or replace function public.unlink_partner()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_partner_id uuid;
begin
  select partner_user_id into v_partner_id
  from public.user_settings
  where user_id = auth.uid();

  -- clear current user's link
  update public.user_settings
    set partner_user_id = null
    where user_id = auth.uid();

  -- clear partner's link if present
  if v_partner_id is not null then
    update public.user_settings
      set partner_user_id = null
      where user_id = v_partner_id;
  end if;

  return true;
end;
$$;

grant execute on function public.unlink_partner() to authenticated;
