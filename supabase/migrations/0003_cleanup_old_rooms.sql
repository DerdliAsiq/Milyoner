-- Yeni oda açılırken 24 saatten uzun süredir hareket görmeyen odaları temizler.
-- Kron gerektirmez; temizlik create_game_room çağrısının parçasıdır.

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

  delete from public.game_rooms
   where id in (
     select room_id from public.game_states
      where updated_at < now() - interval '24 hours'
   );

  insert into public.game_rooms (code, mode, host_name, status)
  values (upper(trim(p_code)), p_mode, p_host_name, 'playing')
  returning id into v_id;

  insert into public.game_states (room_id, state, version)
  values (v_id, p_state, 1);

  return v_id;
end;
$$;

revoke all on function public.create_game_room(text, text, text, jsonb) from public;
grant execute on function public.create_game_room(text, text, text, jsonb) to anon, authenticated;
