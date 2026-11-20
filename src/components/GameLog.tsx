import type { GameState } from '../game/types'

export function GameLog({ state }: { state: GameState }) {
  return (
    <section className="panel log-panel">
      <h2 className="panel__title">📜 Oyun Kaydı</h2>
      <ol className="log-list">
        {state.log.slice(0, 40).map((entry, i) => (
          <li key={`${i}-${entry}`} className={i === 0 ? 'log-list__new' : ''}>{entry}</li>
        ))}
      </ol>
    </section>
  )
}
