-- Create friend_links table
create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  user_id_a uuid not null references auth.users(id) on delete cascade,
  user_id_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friend_links_pair_check check (user_id_a <> user_id_b),
  constraint friend_links_pair_order check (user_id_a < user_id_b),
  constraint friend_links_pair_unique unique (user_id_a, user_id_b)
);

alter table public.friend_links enable row level security;

-- Policies: a user can see and manage links they are a member of
create policy if not exists friend_links_select on public.friend_links
  for select using (auth.uid() = user_id_a or auth.uid() = user_id_b);

create policy if not exists friend_links_insert on public.friend_links
  for insert with check (auth.uid() = user_id_a or auth.uid() = user_id_b);

create policy if not exists friend_links_delete on public.friend_links
  for delete using (auth.uid() = user_id_a or auth.uid() = user_id_b);
