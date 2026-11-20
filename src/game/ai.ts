import { BOARD } from './board'
import { HAND_LIMIT } from './rules'
import type { Action, GameState } from './types'

/** Heuristic bot: buy cheap, sell expensive, bluff at the casino. */
export function chooseAiAction(state: GameState): Action {
  const player = state.players[state.current]
  const tile = BOARD[player.position]

  switch (state.phase) {
    case 'roll':
      return { type: 'ROLL' }

    case 'cardReveal': {
      const card = state.pendingCard
      if (!card) return { type: 'PASS' }
      const multiplier = tile.multiplier ?? 1
      const cost = card.price * multiplier

      if (state.mode === 'walletBattle') {
        return player.cash >= cost ? { type: 'BUY' } : { type: 'PASS' }
      }
      if (multiplier >= 7 && player.items.length > 0) {
        const best = [...player.items].sort((a, b) => b.price - a.price)[0]
        return { type: 'SELL', cardId: best.id }
      }
      if (multiplier <= 4 && player.cash >= cost && player.items.length < HAND_LIMIT.millionaires) {
        return { type: 'BUY' }
      }
      return { type: 'PASS' }
    }

    case 'casino': {
      const amount = Math.min(1_000, Math.max(1, Math.floor(player.cash * 0.02)))
      if (player.cash < amount) return { type: 'CASINO_SKIP' }
      const guess = (state.seed % 6) + 1
      return { type: 'CASINO_BET', guess, amount }
    }

    case 'jailTurn':
      return player.abilities.includes('lawyer') ? { type: 'JAIL_USE_LAWYER' } : { type: 'JAIL_ROLL' }

    case 'jailEntry':
      return player.abilities.includes('lawyer') ? { type: 'JAIL_USE_LAWYER' } : { type: 'JAIL_ACCEPT' }

    default:
      return { type: 'PASS' }
  }
}
