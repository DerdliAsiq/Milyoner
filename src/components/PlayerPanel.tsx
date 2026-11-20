import { ABILITY_INFO } from '../game/cards'
import { formatMoney } from '../game/rules'
import type { GameState } from '../game/types'

export function PlayerPanel({ state, myToken }: { state: GameState; myToken: string | null }) {
  const sorted = [...state.players].sort((a, b) => b.cash - a.cash)

  return (
    <section className="panel players-panel">
      <h2 className="panel__title">💼 Milyonerler</h2>
      <ul className="player-list">
        {sorted.map((p) => (
          <li
            key={p.id}
            className={`player-row ${p.id === state.players[state.current].id ? 'player-row--active' : ''} ${p.eliminated ? 'player-row--out' : ''}`}
          >
            <span className="player-row__dot" style={{ background: p.color }} />
            <div className="player-row__main">
              <div className="player-row__name">
                {p.name}
                {p.isBot && <span className="tag">BOT</span>}
                {p.id === `p${state.bankerIndex}` && <span className="tag tag--gold">BANKER</span>}
                {myToken && p.seatToken === myToken && <span className="tag tag--you">SEN</span>}
                {!p.claimed && !p.isBot && <span className="tag">BOŞ KOLTUK</span>}
              </div>
              <div className="player-row__meta">
                {p.inJail && <span className="tag tag--red">HAPİSTE</span>}
                {p.eliminated && <span className="tag tag--red">ELENDİ</span>}
                {p.abilities.map((a, index) => (
                  <span key={`${a}-${index}`} title={ABILITY_INFO[a].name}>{ABILITY_INFO[a].emoji}</span>
                ))}
              </div>
            </div>
            <div className="player-row__stats">
              <strong>{formatMoney(p.cash)}</strong>
              <span>{p.items.length} kart</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
