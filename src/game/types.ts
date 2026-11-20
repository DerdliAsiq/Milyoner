export type GameMode = 'millionaires' | 'walletBattle'

export type Ability = 'teleport' | 'pistol' | 'lawyer'

export interface ItemCard {
  id: string
  name: string
  emoji: string
  price: number
  color: string
}

export interface Player {
  id: string
  name: string
  color: string
  isBot: boolean
  /** A seat is bound to one browser in online play. */
  seatToken: string
  claimed: boolean
  cash: number
  position: number
  items: ItemCard[]
  abilities: Ability[]
  inJail: boolean
  eliminated: boolean
}

export type Phase =
  | 'roll'
  | 'cardReveal'
  | 'casino'
  | 'jailEntry'
  | 'jailTurn'
  | 'gameOver'

export interface GameState {
  mode: GameMode
  target: number
  players: Player[]
  current: number
  deck: ItemCard[]
  discard: ItemCard[]
  abilityDeck: Ability[]
  phase: Phase
  dice: [number, number] | null
  jailRoll: { player: number; guard: number } | null
  pendingCard: ItemCard | null
  doubles: number
  bankerIndex: number
  round: number
  log: string[]
  winnerId: string | null
  seed: number
  version: number
}

interface Actor {
  /** Present in online play; the engine rejects actions from the wrong seat. */
  actorToken?: string
}

export type Action =
  | ({ type: 'CLAIM_SEAT'; seatIndex: number; token: string } & Actor)
  | ({ type: 'ROLL' } & Actor)
  | ({ type: 'BUY' } & Actor)
  | ({ type: 'SELL'; cardId: string } & Actor)
  | ({ type: 'PASS' } & Actor)
  | ({ type: 'CASINO_BET'; guess: number; amount: number } & Actor)
  | ({ type: 'CASINO_SKIP' } & Actor)
  | ({ type: 'JAIL_USE_LAWYER' } & Actor)
  | ({ type: 'JAIL_ROLL' } & Actor)
  | ({ type: 'JAIL_ACCEPT' } & Actor)
  | ({ type: 'USE_TELEPORT_CARD'; to: number } & Actor)
  | ({ type: 'RESTART' } & Actor)

export interface SetupConfig {
  mode: GameMode
  players: { name: string; isBot: boolean }[]
  target?: number
  seed?: number
}
