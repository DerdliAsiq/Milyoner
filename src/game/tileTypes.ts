export type TileType = 'start' | 'buySell' | 'casino' | 'city' | 'robber' | 'jail'

export interface Tile {
  index: number
  row: number
  col: number
  type: TileType
  label: string
  color: string
  multiplier?: number
}
