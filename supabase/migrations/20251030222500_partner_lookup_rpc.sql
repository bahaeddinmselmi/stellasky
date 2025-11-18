-- Create secure partner lookup RPC to bypass RLS safely
create or replace function public.find_partner_by_code(p_code text)
returns table (
  user_id uuid,
  partner_display_name text,
  partner_user_id uuid,
  partner_share_code text
)
language sql
security definer
set search_path = public
as $$
  select us.user_id, us.partner_display_name, us.partner_user_id, us.partner_share_code
  from public.user_settings us
  where upper(us.partner_share_code) = upper(p_code)
  limit 1;
$$;

-- Grant execute to authenticated users
grant execute on function public.find_partner_by_code(text) to authenticated;
