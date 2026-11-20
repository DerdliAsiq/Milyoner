-- AELSA Milyoner — oyun odaları ve senkronize oyun durumu.
-- Mevcut uygulama tablolarına (users, posts, ...) dokunmaz.

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('millionaires', 'walletBattle')),
  host_name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.game_states (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;
alter table public.game_states enable row level security;

grant select, insert, update on public.game_rooms to anon, authenticated;
grant select, insert, update on public.game_states to anon, authenticated;

drop policy if exists "game_rooms_all" on public.game_rooms;
create policy "game_rooms_all" on public.game_rooms
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "game_states_all" on public.game_states;
create policy "game_states_all" on public.game_states
  for all to anon, authenticated using (true) with check (true);

-- Realtime: oda durumundaki değişiklikler tarayıcılara anında iletilir.
do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_states;
exception when others then null; end $$;
