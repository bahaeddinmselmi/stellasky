-- Securely link partners by share code, updating both sides
create or replace function public.link_partner(p_code text)
returns table (
  linked boolean,
  partner_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_partner_id uuid;
begin
  -- locate partner by share code (case-insensitive)
  select us.user_id into v_partner_id
  from public.user_settings us
  where upper(us.partner_share_code) = upper(p_code)
  limit 1;

  if v_partner_id is null then
    linked := false; partner_id := null; return;
  end if;

  if v_partner_id = auth.uid() then
    linked := false; partner_id := null; return; -- cannot link to self
  end if;

  -- set reciprocal links
  update public.user_settings
    set partner_user_id = v_partner_id
    where user_id = auth.uid();

  update public.user_settings
    set partner_user_id = auth.uid()
    where user_id = v_partner_id;

  linked := true; partner_id := v_partner_id; return;
end;
$$;

grant execute on function public.link_partner(text) to authenticated;
