import type { GameMode, GameState } from '../game/types'
import { supabase } from './supabase'

export interface Room {
  id: string
  code: string
  mode: GameMode
  host_name: string
  status: string
  created_at: string
}

/** Thrown when another client won the race; caller must refetch the snapshot. */
export class StaleStateError extends Error {
  constructor() {
    super('Oyun durumu başka bir oyuncu tarafından güncellendi.')
    this.name = 'StaleStateError'
  }
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createRoom(mode: GameMode, hostName: string, state: GameState): Promise<Room> {
  if (!supabase) throw new Error('Supabase bağlantısı yapılandırılmamış.')
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeCode()
    const { data, error } = await supabase.rpc('create_game_room', {
      p_code: code,
      p_mode: mode,
      p_host_name: hostName,
      p_state: state,
    })
    if (!error && data) {
      return {
        id: data as string,
        code,
        mode,
        host_name: hostName,
        status: 'playing',
        created_at: new Date().toISOString(),
      }
    }
    if (error && error.code !== '23505') throw error // unique_violation -> retry
  }
  throw new Error('Oda kodu oluşturulamadı, tekrar deneyin.')
}

export async function joinRoom(code: string): Promise<{ room: Room; state: GameState }> {
  if (!supabase) throw new Error('Supabase bağlantısı yapılandırılmamış.')
  const { data: room, error } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .single()
  if (error) throw error

  const { data: snapshot, error: stateError } = await supabase
    .from('game_states')
    .select('state')
    .eq('room_id', room.id)
    .single()
  if (stateError) throw stateError
  return { room: room as Room, state: snapshot.state as GameState }
}

/**
 * Compare-and-swap write: the server rejects the update if the local snapshot
 * is stale, and validates that the caller knows the room code.
 */
export async function commitState(roomId: string, code: string, state: GameState): Promise<number> {
  if (!supabase) return state.version
  const { data, error } = await supabase.rpc('commit_game_state', {
    p_room_id: roomId,
    p_code: code,
    p_expected_version: state.version - 1,
    p_state: state,
  })
  if (error) throw error
  const version = data as number
  if (version < 0) throw new StaleStateError()
  return version
}

export interface RoomSubscription {
  onState: (state: GameState) => void
  onDisconnect?: () => void
}

export function subscribeRoom(roomId: string, handlers: RoomSubscription): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`room-${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const next = (payload.new as { state?: GameState } | null)?.state
        if (next) handlers.onState(next)
      },
    )
    .subscribe((status) => {
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handlers.onDisconnect?.()
      }
    })

  return () => {
    void supabase!.removeChannel(channel)
  }
}
