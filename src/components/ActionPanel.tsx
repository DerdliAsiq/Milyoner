import { useState } from 'react'
import { BOARD } from '../game/board'
import { ABILITY_INFO } from '../game/cards'
import { formatMoney, HAND_LIMIT } from '../game/rules'
import type { Action, GameState } from '../game/types'

interface Props {
  state: GameState
  /** Seat token in online play; undefined for local hot-seat. */
  actorToken?: string
  canRestart: boolean
  onAction: (action: Action) => void
}

const PHASE_TITLE: Record<GameState['phase'], string> = {
  roll: '🎲 Sıra sende',
  cardReveal: '🛒 Alış-Satış karesi',
  casino: '🎰 Kumarhane',
  jailEntry: '🚔 Hapis',
  jailTurn: '🔒 Hapisten kaçış',
  gameOver: '🏆 Oyun bitti',
}

export function ActionPanel({ state, actorToken, canRestart, onAction }: Props) {
  const [sellId, setSellId] = useState<string | null>(null)
  const [guess, setGuess] = useState(1)
  const [amount, setAmount] = useState(1_000)
  const [teleportOpen, setTeleportOpen] = useState(false)
  const [teleportTo, setTeleportTo] = useState(0)

  if (state.phase === 'gameOver') {
    const winner = state.players.find((p) => p.id === state.winnerId)
    return (
      <section className="panel action-panel action-panel--over">
        <div className="trophy">🏆</div>
        <h2 className="panel__title">{winner?.name ?? '?'} kazandı!</h2>
        <p className="muted">
          {state.mode === 'millionaires'
            ? `${formatMoney(winner?.cash ?? 0)} nakit ile 1 milyona ulaştı.`
            : `${winner?.items.length ?? 0} VIP kart topladı.`}
        </p>
        <button
          className="btn btn--primary btn--wide"
          disabled={!canRestart}
          title={canRestart ? undefined : 'Sadece oda kurucusu yeni oyun başlatabilir'}
          onClick={() => onAction({ type: 'RESTART' })}
        >
          🔁 Yeni Oyun
        </button>
      </section>
    )
  }

  const player = state.players[state.current]
  const tile = BOARD[player.position]
  const canAct = !player.isBot && (!actorToken || player.seatToken === actorToken)
  const cost = state.pendingCard ? state.pendingCard.price * (tile.multiplier ?? 1) : 0
  const affordable = player.cash >= cost && player.items.length < HAND_LIMIT[state.mode]

  return (
    <section className="panel action-panel">
      <h2 className="panel__title">{PHASE_TITLE[state.phase]}</h2>
      <p className="action-sub">
        {canAct ? `${player.name} · sıra sende` : `${player.name} düşünüyor...`}
      </p>

      {state.phase === 'roll' && (
        <div className="action-body">
          <button className="btn btn--primary btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'ROLL' })}>
            🎲 Zar At
          </button>
          {player.abilities.includes('teleport') && (
            <>
              <button className="btn btn--ghost btn--wide" disabled={!canAct} onClick={() => setTeleportOpen((v) => !v)}>
                🌀 Teleport Kullan
              </button>
              {teleportOpen && (
                <div className="inline-form">
                  <select value={teleportTo} onChange={(e) => setTeleportTo(Number(e.target.value))}>
                    {BOARD.map((t) => (
                      <option key={t.index} value={t.index}>
                        {t.index + 1}. kare · {t.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn--small" onClick={() => { onAction({ type: 'USE_TELEPORT_CARD', to: teleportTo }); setTeleportOpen(false) }}>
                    Işınlan
                  </button>
                </div>
              )}
            </>
          )}
          <p className="hint">İpucu: Düşük çarpanlı karelerde al, yüksek çarpanlılarda sat.</p>
        </div>
      )}

      {state.phase === 'cardReveal' && state.pendingCard && (
        <div className="action-body">
          <div className="reveal-card" style={{ borderColor: state.pendingCard.color }}>
            <span className="reveal-card__emoji">{state.pendingCard.emoji}</span>
            <strong>{state.pendingCard.name}</strong>
            <span className="muted">Kart değeri: {formatMoney(state.pendingCard.price)}</span>
            <span className="reveal-card__price">{formatMoney(cost)} <small>({tile.multiplier}×)</small></span>
          </div>

          <button
            className="btn btn--primary btn--wide"
            disabled={!canAct || !affordable}
            onClick={() => onAction({ type: 'BUY' })}
          >
            🛒 Satın Al · {formatMoney(cost)}
          </button>

          {state.mode === 'millionaires' && player.items.length > 0 && (
            <div className="inline-form">
              <select value={sellId ?? ''} onChange={(e) => setSellId(e.target.value)}>
                <option value="">Satmak için kart seç...</option>
                {player.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name} → {formatMoney(c.price * (tile.multiplier ?? 1))}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--small btn--sell"
                disabled={!canAct || !sellId}
                onClick={() => { if (sellId) { onAction({ type: 'SELL', cardId: sellId }); setSellId(null) } }}
              >
                Sat
              </button>
            </div>
          )}

          <button className="btn btn--ghost btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'PASS' })}>
            {state.mode === 'walletBattle' && !affordable ? '💸 Ödeyemiyorum (elenecek)' : '➡️ Geç'}
          </button>
        </div>
      )}

      {state.phase === 'casino' && (
        <div className="action-body">
          <p className="hint">1–6 arası bir sayı tut. Bir zar tutarsan 2×, ikisi de tutarsan 3× kazanırsın.</p>
          <div className="guess-row">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={`guess ${guess === n ? 'guess--on' : ''}`} onClick={() => setGuess(n)}>{n}</button>
            ))}
          </div>
          <label className="field-label">
            Bahis tutarı
            <input
              type="number"
              min={1}
              max={player.cash}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button
            className="btn btn--primary btn--wide"
            disabled={!canAct || amount < 1 || amount > player.cash}
            onClick={() => onAction({ type: 'CASINO_BET', guess, amount })}
          >
            🎰 Bahis Yap · {formatMoney(amount)}
          </button>
          <button className="btn btn--ghost btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'CASINO_SKIP' })}>
            Geç
          </button>
        </div>
      )}

      {state.phase === 'jailEntry' && (
        <div className="action-body">
          <p className="hint">Avukatın var. Hapisten kaçıp tüm mallarını koruyabilirsin.</p>
          <button className="btn btn--primary btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'JAIL_USE_LAWYER' })}>
            ⚖️ {ABILITY_INFO.lawyer.emoji} Avukatı Kullan
          </button>
          <button className="btn btn--ghost btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'JAIL_ACCEPT' })}>
            Hapisi Kabul Et
          </button>
        </div>
      )}

      {state.phase === 'jailTurn' && (
        <div className="action-body">
          <p className="hint">
            Hapishane müdürüyle zar yarışı.Senin zarın büyükse serbest kalırsın.
            {state.jailRoll && ` (Son deneme: ${state.jailRoll.player} ↔ ${state.jailRoll.guard})`}
          </p>
          <button className="btn btn--primary btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'JAIL_ROLL' })}>
            🎲 Zar At
          </button>
          {player.abilities.includes('lawyer') && (
            <button className="btn btn--ghost btn--wide" disabled={!canAct} onClick={() => onAction({ type: 'JAIL_USE_LAWYER' })}>
              ⚖️ Avukatı Kullan
            </button>
          )}
        </div>
      )}
    </section>
  )
}
