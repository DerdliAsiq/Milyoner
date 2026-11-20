import type { GameMode } from './types'

export const BANKER_SALARY = 5_000
export const START_CASH: Record<GameMode, number> = {
  millionaires: 50_000,
  walletBattle: 1_000_000,
}
export const TARGET: Record<GameMode, number> = {
  millionaires: 1_000_000,
  walletBattle: 12, // number of VIP cards
}
export const HAND_LIMIT: Record<GameMode, number> = {
  millionaires: 5,
  walletBattle: Infinity,
}

export const PLAYER_COLORS = ['#f2c14e', '#4fc3f7', '#ef6f6c', '#7ed957', '#b07fe0', '#ff9f43']

export function formatMoney(value: number): string {
  return `${value.toLocaleString('tr-TR')} ₺`
}
