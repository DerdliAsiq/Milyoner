import type { Tile } from './tileTypes'

export const BOARD_SIZE = 32

const C = {
  blue: '#2f8fd8',
  orange: '#f2912f',
  purple: '#8050ad',
  green: '#63a83f',
  red: '#d9443b',
  yellow: '#e3c12c',
  pink: '#e46280',
  gray: '#9aa0a6',
  olive: '#8b9d2e',
}

/** 32 tiles laid clockwise around a 9x9 CSS grid perimeter. */
const BUY_MULTIPLIERS: (number | null)[] = [
  /* 0 START */ null,
  7, 3, 8, /* 4 CASINO */ null, 6, 5, 10,
  /* 8 CITY */ null,
  1, 8, 2, 7, 3, 8, 4,
  /* 16 ROBBER */ null,
  9, 5, 1, 6, 2, 7, 3,
  /* 24 JAIL */ null,
  8, 4, 9, 5, 1, 6, 2,
]

const BUY_COLORS = [
  C.blue, C.orange, C.purple, C.green, C.red, C.purple, C.gray,
  C.yellow, C.green, C.pink, C.blue, C.orange, C.purple, C.olive,
  C.red, C.purple, C.yellow, C.green, C.pink, C.blue, C.orange,
  C.purple, C.olive, C.red, C.purple, C.yellow, C.green, C.pink,
]

/** grid coordinates for perimeter cells of a 9x9 grid, clockwise from (0,0). */
function perimeterPosition(index: number): { row: number; col: number } {
  if (index <= 8) return { row: 1, col: index + 1 }
  if (index <= 16) return { row: index - 8 + 1, col: 9 }
  if (index <= 24) return { row: 9, col: 9 - (index - 16) }
  return { row: 9 - (index - 24), col: 1 }
}

const SPECIAL: Record<number, { type: Tile['type']; label: string; color: string }> = {
  0: { type: 'start', label: 'BAŞLANGIÇ', color: '#f5c542' },
  4: { type: 'casino', label: 'KUMARHANE', color: '#b3245e' },
  8: { type: 'city', label: 'CITY', color: '#1d5fa8' },
  16: { type: 'robber', label: 'SOYGUNCU', color: '#8b1f1f' },
  24: { type: 'jail', label: 'HAPİS', color: '#3b3b52' },
}

let colorCursor = 0

export const BOARD: Tile[] = Array.from({ length: BOARD_SIZE }, (_, index) => {
  const { row, col } = perimeterPosition(index)
  const special = SPECIAL[index]
  if (special) {
    return { index, row, col, type: special.type, label: special.label, color: special.color }
  }
  const multiplier = BUY_MULTIPLIERS[index] ?? 1
  const color = BUY_COLORS[colorCursor++ % BUY_COLORS.length]
  return {
    index,
    row,
    col,
    type: 'buySell',
    label: `×${multiplier}`,
    color,
    multiplier,
  }
})
