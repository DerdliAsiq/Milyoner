import { useMemo, type CSSProperties } from 'react'
import { BOARD } from '../game/board'
import { ABILITY_INFO } from '../game/cards'
import { formatMoney } from '../game/rules'
import type { GameState, Player } from '../game/types'

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

const TILE_ICONS: Record<string, string> = {
  start: '🏁',
  casino: '🎰',
  city: '✈️',
  robber: '🦹',
  jail: '🚔',
}

export function Board({ state }: { state: GameState }) {
  const pawnsByTile = useMemo(() => {
    const map = new Map<number, Player[]>()
    for (const player of state.players) {
      if (player.eliminated) continue
      map.set(player.position, [...(map.get(player.position) ?? []), player])
    }
    return map
  }, [state.players])

  const current = state.players[state.current]
  const winner = state.players.find((p) => p.id === state.winnerId)
  const progress = state.mode === 'millionaires'
    ? Math.min(100, (current.cash / state.target) * 100)
    : Math.min(100, (current.items.length / state.target) * 100)

  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((tile) => {
          const pawns = pawnsByTile.get(tile.index) ?? []
          const style = { '--tile-color': tile.color } as CSSProperties
          return (
            <div
              key={tile.index}
              className={`tile tile--${tile.type}`}
              style={{ ...style, gridRow: tile.row, gridColumn: tile.col }}
              title={`${tile.label}${tile.multiplier ? ` · ${tile.multiplier}× fiyat` : ''}`}
            >
              <span className="tile__label">{tile.label}</span>
              <span className="tile__icon">{TILE_ICONS[tile.type] ?? '🛒'}</span>
              {pawns.length > 0 && (
                <span className="tile__pawns">
                  {pawns.map((p) => (
                    <span key={p.id} className="pawn" style={{ background: p.color }} title={p.name}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )
        })}

        <div className="board-center">
          <div className="board-center__top">
            <span className="mode-pill">{state.mode === 'millionaires' ? 'OYUN 1 · MİLLİONERLER' : 'OYUN 2 · CÜZDAN SAVAŞI'}</span>
            <span className="round-pill">{state.round}. tur</span>
          </div>

          <h1 className="brand">MİLLİONERLER</h1>
          <div className="brand-sub">✦ Cüzdan Savaşı ✦</div>

          <div className="product-strip" aria-hidden="true">
            🚗 🏍️ 🍰 ⌚ 🚲 💻 🌹 ⚽ 💎
          </div>

          <div className={`dice ${state.dice ? 'dice--rolled' : ''}`}>
            {state.dice ? (
              <>
                <span>{DIE_FACES[state.dice[0]]}</span>
                <span>{DIE_FACES[state.dice[1]]}</span>
              </>
            ) : (
              <span className="dice__idle">🎲 🎲</span>
            )}
          </div>

          {winner ? (
            <div className="center-status center-status--win">
              <div className="center-status__label">🏆 KAZANAN</div>
              <strong>{winner.name}</strong>
              <span>{formatMoney(winner.cash)} · {winner.items.length} kart</span>
            </div>
          ) : (
            <div className="center-status">
              <div className="center-status__label">SIRA · {current.name}</div>
              <strong>{formatMoney(current.cash)}</strong>
              <span>{current.items.length} kart · {current.abilities.map((a) => ABILITY_INFO[a].emoji).join(' ') || '—'}</span>
            </div>
          )}

          <div className="progress">
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress__caption">
            {state.mode === 'millionaires'
              ? `${formatMoney(current.cash)} / ${formatMoney(state.target)}`
              : `${current.items.length} / ${state.target} VIP kart`}
          </div>
        </div>
      </div>
    </div>
  )
}
