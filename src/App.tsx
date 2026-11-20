import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionPanel } from './components/ActionPanel'
import { Board } from './components/Board'
import { GameLog } from './components/GameLog'
import { PlayerPanel } from './components/PlayerPanel'
import { SetupScreen, type StartRequest } from './components/SetupScreen'
import { chooseAiAction } from './game/ai'
import { applyAction, createGame } from './game/engine'
import type { Action, GameState } from './game/types'
import { commitState, createRoom, joinRoom, StaleStateError, subscribeRoom } from './lib/online'
import { isOnlineReady } from './lib/supabase'

type Connection = 'offline' | 'reconnecting' | 'error' | 'online'

interface RoomInfo {
  id: string
  code: string
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [roomIdState, setRoomIdState] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>('offline')
  const [myToken, setMyToken] = useState<string | null>(null)
  const [mySeatIndex, setMySeatIndex] = useState(0)

  const stateRef = useRef<GameState | null>(null)
  const roomRef = useRef<RoomInfo | null>(null)
  const tokenRef = useRef<string | null>(null)
  const seatRef = useRef(0)

  const setGame = useCallback((next: GameState | null) => {
    stateRef.current = next
    setState(next)
  }, [])

  const refetch = useCallback(async (): Promise<GameState | null> => {
    const room = roomRef.current
    if (!room) return stateRef.current
    const { state: fresh } = await joinRoom(room.code)
    // Keep our seat if it still exists; otherwise become a spectator.
    if (tokenRef.current && !fresh.players.some((p) => p.seatToken === tokenRef.current)) {
      tokenRef.current = null
      setMyToken(null)
    }
    setGame(fresh)
    return fresh
  }, [setGame])

  const applyLocal = useCallback(
    async (action: Action, retry = 0): Promise<void> => {
      const prev = stateRef.current
      if (!prev) return
      const isSeatAction = action.type === 'CLAIM_SEAT'
      const owned: Action = isSeatAction || !tokenRef.current
        ? action
        : ({ ...action, actorToken: tokenRef.current } as Action)
      const next = applyAction(prev, owned)
      if (next === prev) return

      setGame(next)
      const room = roomRef.current
      if (!room) return

      try {
        await commitState(room.id, room.code, next)
        setConnection('online')
      } catch (cause) {
        if (cause instanceof StaleStateError && retry < 3) {
          await refetch()
          await applyLocal(action, retry + 1)
        } else {
          setConnection('error')
          setError(cause instanceof Error ? cause.message : 'Durum gönderilemedi.')
        }
      }
    },
    [refetch, setGame],
  )

  useEffect(() => {
    const room = roomRef.current
    if (!room) return
    return subscribeRoom(room.id, {
      onState: (incoming) => {
        const local = stateRef.current
        if (!local || incoming.version >= local.version) setGame(incoming)
      },
      onDisconnect: () => {
        setConnection('reconnecting')
        void refetch().then(() => setConnection('online')).catch(() => setConnection('error'))
      },
    })
  }, [roomIdState, refetch, setGame])

  // Only the host drives bot turns; every client running bots causes duplicate moves.
  useEffect(() => {
    if (!state || state.phase === 'gameOver') return
    if (seatRef.current !== 0) return
    const player = state.players[state.current]
    if (!player.isBot) return
    const version = state.version

    const timer = window.setTimeout(() => {
      if (stateRef.current?.version !== version) return
      void applyLocal(chooseAiAction(stateRef.current!))
    }, 750)

    return () => window.clearTimeout(timer)
  }, [state, applyLocal])

  const handleStart = async (request: StartRequest) => {
    setBusy(true)
    setError(null)
    setConnection('offline')
    try {
      if (request.kind === 'local') {
        roomRef.current = null
        setRoomIdState(null)
        const game = createGame(request.config)
        tokenRef.current = null
        seatRef.current = 0
        setMyToken(null)
        setMySeatIndex(0)
        setGame(game)
        setConnection('offline')
      } else if (request.kind === 'create') {
        const game = createGame(request.config)
        const room = await createRoom(request.config.mode, request.config.players[0].name, game)
        roomRef.current = { id: room.id, code: room.code }
        setRoomIdState(room.id)
        tokenRef.current = game.players[0].seatToken
        seatRef.current = 0
        setMyToken(tokenRef.current)
        setMySeatIndex(0)
        setGame(game)
        setConnection('online')
      } else {
        const { room, state: remote } = await joinRoom(request.code)
        roomRef.current = { id: room.id, code: room.code }
        setRoomIdState(room.id)
        setGame(remote)
        setConnection('online')

        // Prefer an unclaimed human seat; otherwise take over a bot seat.
        const seatIndex = remote.players.findIndex((p) => !p.claimed && !p.isBot)
        const botSeatIndex = remote.players.findIndex((p) => p.isBot)
        const targetSeat = seatIndex >= 0 ? seatIndex : botSeatIndex
        if (targetSeat >= 0) {
          const token = crypto.randomUUID()
          tokenRef.current = token
          seatRef.current = targetSeat
          setMyToken(token)
          setMySeatIndex(targetSeat)
          await applyLocal({ type: 'CLAIM_SEAT', seatIndex: targetSeat, token })
        } else {
          tokenRef.current = null
          setMyToken(null)
          setError('Oda dolu — seyirci olarak katıldın.')
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bir hata oluştu.')
    } finally {
      setBusy(false)
    }
  }

  const leaveGame = () => {
    roomRef.current = null
    setRoomIdState(null)
    tokenRef.current = null
    seatRef.current = 0
    setMyToken(null)
    setMySeatIndex(0)
    setConnection('offline')
    setError(null)
    setGame(null)
  }

  if (!state) {
    return <SetupScreen onStart={handleStart} busy={busy} error={error} onlineReady={isOnlineReady} />
  }

  return (
    <div className="game">
      <header className="game__bar">
        <div className="game__brand">
          <span>💎</span> AELSA <strong>MİLYONER</strong>
        </div>
        <div className="game__bar-info">
          <span className="pill">{state.mode === 'millionaires' ? 'OYUN 1' : 'OYUN 2'}</span>
          <span className="pill">{state.round}. tur</span>
          {roomRef.current && (
            <>
              <span className={`pill ${connection === 'online' ? 'pill--code' : 'pill--warn'}`}>
                {connection === 'online' ? '🌐' : '⚠️'} ODA: {roomRef.current.code}
              </span>
              {myToken && <span className="pill">KOLTUK {mySeatIndex + 1}</span>}
            </>
          )}
          <button className="pill pill--exit" onClick={leaveGame}>← Çık</button>
        </div>
      </header>

      {connection !== 'offline' && connection !== 'online' && (
        <div className="connection-banner">
          {connection === 'reconnecting'
            ? '🔄 Bağlantı koptu, oyun durumu yeniden alınıyor...'
            : `⚠️ Sunucuya yazılamadı: ${error ?? 'Bağlantıyı kontrol edip tekrar dene.'}`}
        </div>
      )}

      <div className="game__layout">
        <aside className="game__side">
          <PlayerPanel state={state} myToken={myToken} />
        </aside>
        <main className="game__main">
          <Board state={state} />
        </main>
        <aside className="game__side game__side--right">
          <ActionPanel
            state={state}
            actorToken={myToken ?? undefined}
            canRestart={!roomRef.current || mySeatIndex === 0}
            onAction={(action) => void applyLocal(action)}
          />
          <GameLog state={state} />
        </aside>
      </div>
    </div>
  )
}
