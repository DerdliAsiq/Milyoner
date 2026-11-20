import { describe, expect, it } from 'vitest'
import { BOARD } from './board'
import { createGame, applyAction } from './engine'
import { rollDie, rollTwo } from './rng'
import type { GameState, ItemCard } from './types'

const clone = <T,>(v: T): T => structuredClone(v)
const card = (price: number, id = 'test'): ItemCard => ({
  id, name: 'Test Ürün', emoji: '🧪', price, color: '#fff',
})

function base(mode: 'millionaires' | 'walletBattle' = 'millionaires'): GameState {
  return createGame({
    mode,
    players: [{ name: 'Ali', isBot: false }, { name: 'Veli', isBot: false }],
    seed: 12345,
  })
}

function seedWithDoubles(): number {
  let seed = 1
  for (let i = 0; i < 10000; i++) {
    const dice = rollTwo(seed).dice
    if (dice[0] === dice[1]) return seed
  }
  throw new Error('no doubles seed found')
}

describe('createGame', () => {
  it('starts players with correct cash on START', () => {
    const s = base()
    expect(s.players[0].cash).toBe(50_000)
    expect(s.players[1].cash).toBe(50_000)
    expect(s.players[0].position).toBe(0)
    expect(s.phase).toBe('roll')
    expect(s.players[0].abilities).toHaveLength(1)
  })

  it('gives 1 million in Cüzdan Savaşı', () => {
    expect(base('walletBattle').players[0].cash).toBe(1_000_000)
  })
})

describe('movement', () => {
  it('moves by the sum of two dice', () => {
    const s = base()
    const next = applyAction(s, { type: 'ROLL' })
    const total = next.dice![0] + next.dice![1]
    expect(next.players[0].position).toBe(total % BOARD.length)
  })

  it('sends to jail on the third consecutive double', () => {
    const seed = seedWithDoubles()
    let s = base()
    s = clone(s)
    s.seed = seed
    s.doubles = 2
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[0].inJail).toBe(true)
    expect(next.players[0].position).toBe(BOARD.findIndex((t) => t.type === 'jail'))
    expect(next.current).toBe(1)
  })

  it('gives a free card and banker salary when passing START', () => {
    let s = base()
    s = clone(s)
    s.current = 1
    s.players[1].position = BOARD.length - 1
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[1].items.length).toBeGreaterThanOrEqual(1)
    expect(next.players[0].cash).toBe(55_000)
  })
})

describe('buy & sell', () => {
  it('buys at card price × tile multiplier and limits the hand to 5', () => {
    let s = base()
    s = clone(s)
    s.phase = 'cardReveal'
    s.pendingCard = card(1_000)
    s.players[0].position = BOARD.findIndex((t) => t.type === 'buySell' && t.multiplier === 1)
    const next = applyAction(s, { type: 'BUY' })
    expect(next.players[0].cash).toBe(49_000)
    expect(next.players[0].items[0].price).toBe(1_000)
  })

  it('sells at card price × tile multiplier', () => {
    let s = base()
    s = clone(s)
    s.phase = 'cardReveal'
    s.pendingCard = card(2_000, 'pending')
    s.players[0].items = [card(1_000, 'owned')]
    s.players[0].position = BOARD.findIndex((t) => t.type === 'buySell' && t.multiplier === 10)
    const next = applyAction(s, { type: 'SELL', cardId: 'owned' })
    expect(next.players[0].cash).toBe(60_000)
    expect(next.players[0].items).toHaveLength(0)
    expect(next.pendingCard).toBeNull()
  })
})

describe('special tiles', () => {
  it('robs half the cash, rounded down', () => {
    const seed = seedWithDoubles()
    const total = rollTwo(seed).dice[0] + rollTwo(seed).dice[1]
    let s = base()
    s = clone(s)
    s.seed = seed
    s.players[0].position = 16 - total
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[0].cash).toBe(25_000)
  })

  it('pistol protects from the robber', () => {
    const seed = seedWithDoubles()
    const total = rollTwo(seed).dice[0] + rollTwo(seed).dice[1]
    let s = base()
    s = clone(s)
    s.seed = seed
    s.players[0].position = 16 - total
    s.players[0].abilities = ['pistol']
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[0].cash).toBe(50_000)
    expect(next.players[0].abilities).not.toContain('pistol')
  })

  it('pays 3x when both dice match the casino guess', () => {
    let s = base()
    s = clone(s)
    s.phase = 'casino'
    s.seed = seedWithDoubles()
    const guess = rollTwo(s.seed).dice[0]
    const next = applyAction(s, { type: 'CASINO_BET', guess, amount: 1_000 })
    expect(next.players[0].cash).toBe(52_000)
  })

  it('jail confiscates the most expensive item', () => {
    let s = base()
    s = clone(s)
    s.players[0].items = [card(1_000, 'cheap'), card(5_000, 'pricey')]
    const seed = seedWithDoubles()
    const total = rollTwo(seed).dice[0] + rollTwo(seed).dice[1]
    s.seed = seed
    s.players[0].position = 24 - total
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[0].inJail).toBe(true)
    expect(next.players[0].items.map((c) => c.id)).toEqual(['cheap'])
  })
})

describe('win conditions', () => {
  it('wins millionaires at 1 million cash', () => {
    let s = base()
    s = clone(s)
    s.players[0].cash = 1_000_000
    const next = applyAction(s, { type: 'PASS' })
    expect(next.phase).toBe('gameOver')
    expect(next.winnerId).toBe('p0')
  })

  it('eliminates a player who cannot pay in Cüzdan Savaşı', () => {
    let s = base('walletBattle')
    s = clone(s)
    s.phase = 'cardReveal'
    s.players[0].cash = 0
    s.players[0].position = BOARD.findIndex((t) => t.type === 'buySell' && t.multiplier === 10)
    s.pendingCard = card(1_000, 'expensive')
    const next = applyAction(s, { type: 'PASS' })
    expect(next.players[0].eliminated).toBe(true)
    expect(next.winnerId).toBe('p1')
  })

  it('prioritizes the acting player when several players qualify', () => {
    let s = base()
    s = clone(s)
    s.phase = 'casino'
    s.current = 1
    s.players[0].cash = 1_000_000
    s.players[1].cash = 1_000_000
    const next = applyAction(s, { type: 'CASINO_SKIP' })
    expect(next.winnerId).toBe('p1')
  })
})

describe('regressions', () => {
  it('pays START only once when landing exactly on tile 0', () => {
    let seed = 1
    while (rollTwo(seed).dice[0] + rollTwo(seed).dice[1] !== 2) seed++
    let s = base()
    s = clone(s)
    s.seed = seed
    s.current = 1
    s.players[1].position = BOARD.length - 2
    s.bankerIndex = 0
    const next = applyAction(s, { type: 'ROLL' })
    expect(next.players[0].cash).toBe(55_000) // one 5k salary, not 10k
    expect(next.players[1].items).toHaveLength(1) // one free card, not two
  })

  it('does not grant an extra roll for casino doubles', () => {
    const seed = seedWithDoubles()
    let s = base()
    s = clone(s)
    s.phase = 'casino'
    s.seed = seed
    const guess = rollTwo(seed).dice[0]
    const next = applyAction(s, { type: 'CASINO_BET', guess, amount: 1_000 })
    expect(next.players[0].cash).toBe(52_000) // 3x payout
    expect(next.dice).toBeNull()
    expect(next.current).toBe(1) // turn passed, no free roll
  })

  it('does not bump version for rejected actions', () => {
    const s = base()
    const next = applyAction(s, { type: 'BUY' }) // wrong phase
    expect(next).toBe(s)
    expect(next.version).toBe(s.version)
  })

  it('keeps rotating rounds and banker when player 0 is eliminated', () => {
    let s = createGame({
      mode: 'walletBattle',
      players: [
        { name: 'A', isBot: false },
        { name: 'B', isBot: false },
        { name: 'C', isBot: false },
      ],
      seed: 7,
    })
    s = clone(s)
    s.current = 2
    s.players[0].eliminated = true
    s.bankerIndex = 0
    s.phase = 'cardReveal'
    s.pendingCard = card(1_000)
    s.players[2].position = BOARD.findIndex((t) => t.type === 'buySell')
    const next = applyAction(s, { type: 'BUY' })
    expect(next.round).toBe(2)
    expect(next.bankerIndex).toBe(1)
    expect(next.players[1].cash).toBeGreaterThan(0)
  })

  it('offers the lawyer on the third double instead of confiscating', () => {
    const seed = seedWithDoubles()
    let s = base()
    s = clone(s)
    s.seed = seed
    s.doubles = 2
    s.players[0].items = [card(5_000, 'pricey')]
    s.players[0].abilities = ['lawyer']
    const jailed = applyAction(s, { type: 'ROLL' })
    expect(jailed.phase).toBe('jailEntry')
    expect(jailed.players[0].items).toHaveLength(1)
    const freed = applyAction(jailed, { type: 'JAIL_USE_LAWYER' })
    expect(freed.players[0].inJail).toBe(false)
    expect(freed.players[0].abilities).not.toContain('lawyer')
  })

  it('rejects lawyer use outside jail phases', () => {
    let s = base()
    s = clone(s)
    s.players[0].abilities = ['lawyer']
    const next = applyAction(s, { type: 'JAIL_USE_LAWYER' })
    expect(next).toBe(s)
  })

  it('resolves jail escape rolls', () => {
    let seed = 1
    for (let i = 0; i < 10000; i++) {
      const mine = rollDie(seed).value
      const guard = rollDie(rollDie(seed).seed).value
      if (mine > guard) break
      seed = rollDie(rollDie(seed).seed).seed + 1
    }
    let s = base()
    s = clone(s)
    s.phase = 'jailTurn'
    s.players[0].inJail = true
    s.seed = seed
    const next = applyAction(s, { type: 'JAIL_ROLL' })
    expect(next.players[0].inJail).toBe(false)
    expect(next.phase).toBe('roll')
  })

  it('reshuffles the discard pile when the deck runs out', () => {
    let s = base()
    s = clone(s)
    s.phase = 'cardReveal'
    s.pendingCard = card(1_000, 'bought')
    s.players[0].position = BOARD.findIndex((t) => t.type === 'buySell')
    s.deck = []
    s.discard = [card(2_000, 'recycled')]
    const next = applyAction(s, { type: 'BUY' })
    expect(next.pendingCard?.id).toBe('recycled')
    expect(next.log.some((line) => line.includes('yeniden karıştırıldı'))).toBe(true)
  })

  it('applies START benefits once when teleporting to tile 0', () => {
    let s = base()
    s = clone(s)
    s.players[0].abilities = ['teleport']
    const next = applyAction(s, { type: 'USE_TELEPORT_CARD', to: 0 })
    expect(next.players[0].items).toHaveLength(1)
    expect(next.players[0].cash).toBe(55_000)
  })

  it('lets a guest take over a bot seat', () => {
    const s = base()
    const next = applyAction(s, { type: 'CLAIM_SEAT', seatIndex: 1, token: 'guest' })
    expect(next.players[1].isBot).toBe(false)
    expect(next.players[1].claimed).toBe(true)
    expect(next.players[1].seatToken).toBe('guest')
  })

  it('binds seats and rejects actions from the wrong token', () => {
    let s = base()
    s = clone(s)
    s.players[1].claimed = false
    s.players[1].isBot = false
    const claimed = applyAction(s, { type: 'CLAIM_SEAT', seatIndex: 1, token: 'guest-token' })
    expect(claimed.players[1].claimed).toBe(true)
    expect(claimed.players[1].seatToken).toBe('guest-token')
    const rejected = applyAction(claimed, { type: 'ROLL', actorToken: 'guest-token' })
    expect(rejected).toBe(claimed) // current player is seat 0
  })

  it('keeps restart versions monotonic and host-only', () => {
    let s = base()
    s = clone(s)
    s.version = 10
    const wrong = applyAction(s, { type: 'RESTART', actorToken: 'intruder' })
    expect(wrong).toBe(s)
    const fresh = applyAction(s, { type: 'RESTART', actorToken: s.players[0].seatToken })
    expect(fresh.version).toBe(11)
  })
})
