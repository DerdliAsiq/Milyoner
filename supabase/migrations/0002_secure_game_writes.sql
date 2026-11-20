-- Online oyun yazımlarını güvenli hale getirir:
-- * İstemciler game_rooms/game_states tablolarına doğrudan INSERT/UPDATE yapamaz.
-- * Tüm yazımlar oda kodu (paylaşılan sır) ve beklenen sürüm ile doğrulanan RPC'lerden geçer.
-- * commit_game_state atomik compare-and-swap yapar; eski yazımlar sessizce reddedilir.

create or replace function public.create_game_room(
  p_code text,
  p_mode text,
  p_host_name text,
  p_state jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_code is null or length(trim(p_code)) not between 4 and 8 then
    raise exception 'Geçersiz oda kodu';
  end if;
  if p_mode not in ('millionaires', 'walletBattle') then
    raise exception 'Geçersiz oyun modu';
  end if;

  insert into public.game_rooms (code, mode, host_name, status)
  values (upper(trim(p_code)), p_mode, p_host_name, 'playing')
  returning id into v_id;

  insert into public.game_states (room_id, state, version)
  values (v_id, p_state, 1);

  return v_id;
end;
$$;

create or replace function public.commit_game_state(
  p_room_id uuid,
  p_code text,
  p_expected_version integer,
  p_state jsonb
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
begin
  if not exists (
    select 1 from public.game_rooms
    where id = p_room_id and code = upper(trim(p_code))
  ) then
    return -1;
  end if;

  update public.game_states
     set state = p_state,
         version = version + 1,
         updated_at = now()
   where room_id = p_room_id
     and version = p_expected_version
  returning version into v_version;

  if not found then
    return -1; -- stale client: caller must refetch the snapshot
  end if;
  return v_version;
end;
$$;

revoke all on function public.create_game_room(text, text, text, jsonb) from public;
revoke all on function public.commit_game_state(uuid, text, integer, jsonb) from public;
grant execute on function public.create_game_room(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.commit_game_state(uuid, text, integer, jsonb) to anon, authenticated;

-- Direct table writes are no longer allowed; all writes go through the RPCs above.
revoke insert, update, delete on public.game_rooms from anon, authenticated;
revoke insert, update, delete on public.game_states from anon, authenticated;
