import { BOARD } from './board'
import { createAbilityDeck, createItemDeck } from './cards'
import { rollDie, rollTwo, shuffle } from './rng'
import { BANKER_SALARY, HAND_LIMIT, PLAYER_COLORS, START_CASH, TARGET } from './rules'
import type { Action, GameState, ItemCard, Player, SetupConfig } from './types'

const clone = <T,>(value: T): T => structuredClone(value)

const JAIL_INDEX = BOARD.findIndex((tile) => tile.type === 'jail')

function log(d: GameState, message: string) {
  d.log.unshift(message)
  if (d.log.length > 100) d.log.length = 100
}

function current(d: GameState): Player {
  return d.players[d.current]
}

function activePlayers(d: GameState): Player[] {
  return d.players.filter((p) => !p.eliminated)
}

export function createGame(config: SetupConfig): GameState {
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31)
  const items = createItemDeck(seed)
  const abilities = createAbilityDeck(items.seed)

  const players: Player[] = config.players.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    isBot: p.isBot,
    seatToken: crypto.randomUUID(),
    claimed: p.isBot || i === 0,
    cash: START_CASH[config.mode],
    position: 0,
    items: [],
    abilities: [],
    inJail: false,
    eliminated: false,
  }))

  let s = abilities.seed
  for (const player of players) {
    const roll = rollDie(s)
    s = roll.seed
    const ability = abilities.deck.pop()
    if (ability) player.abilities.push(ability)
  }

  return {
    mode: config.mode,
    target: config.target ?? TARGET[config.mode],
    players,
    current: 0,
    deck: items.deck,
    discard: [],
    abilityDeck: abilities.deck,
    phase: 'roll',
    dice: null,
    jailRoll: null,
    pendingCard: null,
    doubles: 0,
    bankerIndex: 0,
    round: 1,
    log: [`🎬 Oyun başladı! İlk hamle: ${players[0].name}`],
    winnerId: null,
    seed: s,
    version: 1,
  }
}

function checkWin(d: GameState): boolean {
  if (d.mode === 'millionaires') {
    const qualifiers = d.players.filter((p) => p.cash >= d.target)
    const winner = qualifiers.includes(current(d)) ? current(d) : qualifiers[0]
    if (winner) {
      d.winnerId = winner.id
      d.phase = 'gameOver'
      log(d, `🏆 ${winner.name} 1 milyona ulaştı ve oyunu kazandı!`)
      return true
    }
  } else {
    const qualifiers = d.players.filter((p) => p.items.length >= d.target)
    const winner = qualifiers.includes(current(d)) ? current(d) : qualifiers[0]
    if (winner) {
      d.winnerId = winner.id
      d.phase = 'gameOver'
      log(d, `🏆 ${winner.name} 12 VIP kart topladı ve kazandı!`)
      return true
    }
    const alive = activePlayers(d)
    if (alive.length === 1) {
      d.winnerId = alive[0].id
      d.phase = 'gameOver'
      log(d, `🏆 ${alive[0].name} tek kalan oyuncu olarak kazandı!`)
      return true
    }
  }
  return false
}

function drawCard(d: GameState): ItemCard | null {
  if (d.deck.length === 0 && d.discard.length > 0) {
    const result = shuffle(d.discard, d.seed)
    d.deck = result.items
    d.seed = result.seed
    d.discard = []
    log(d, '🔄 Ürün kartları yeniden karıştırıldı.')
  }
  return d.deck.pop() ?? null
}

function startBenefits(d: GameState) {
  const player = current(d)
  const canTake = d.mode === 'walletBattle' || player.items.length < HAND_LIMIT[d.mode]
  if (canTake) {
    const card = drawCard(d)
    if (card) {
      player.items.push(card)
      log(d, `🎁 ${player.name} START'tan ücretsiz kart aldı: ${card.emoji} ${card.name}`)
    }
  }
  let banker = d.players[d.bankerIndex]
  if (!banker || banker.eliminated) {
    const live = activePlayers(d)
    if (live.length === 0) return
    d.bankerIndex = d.players.indexOf(live[0])
    banker = live[0]
  }
  banker.cash += BANKER_SALARY
  log(d, `💼 Banker ${banker.name} tur maaşı aldı: ${BANKER_SALARY.toLocaleString('tr-TR')} ₺`)
}

function movePlayer(d: GameState, steps: number) {
  const player = current(d)
  const from = player.position
  player.position = (from + steps) % BOARD.length
  // A lap crossing and an exact landing on START must be rewarded once, not twice.
  if (from + steps >= BOARD.length) startBenefits(d)
}

function enterJail(d: GameState) {
  const player = current(d)
  player.inJail = true
  player.position = JAIL_INDEX
  if (player.items.length > 0) {
    const worstIndex = player.items.reduce(
      (best, card, index, all) => (card.price > all[best].price ? index : best),
      0,
    )
    const [confiscated] = player.items.splice(worstIndex, 1)
    d.discard.push(confiscated)
    log(d, `🚔 ${player.name} tutuklandı! En değerli malı elendi: ${confiscated.emoji} ${confiscated.name}`)
  } else {
    log(d, `🚔 ${player.name} tutuklandı!`)
  }
}

function finishTurn(d: GameState) {
  if (checkWin(d)) return

  const player = current(d)
  const extraRoll =
    d.dice !== null &&
    d.dice[0] === d.dice[1] &&
    d.doubles < 3 &&
    !player.inJail &&
    !player.eliminated

  if (extraRoll) {
    d.phase = 'roll'
    d.dice = null
    d.pendingCard = null
    log(d, `🎯 ${player.name} çift attı — tekrar zar atıyor!`)
    return
  }

  let next = d.current
  let wrapped = false
  for (let i = 1; i <= d.players.length; i++) {
    const candidate = (d.current + i) % d.players.length
    if (d.players[candidate].eliminated) continue
    next = candidate
    // Wrap either when we pass index 0, or when we crossed the array end
    // (needed when eliminated seats are skipped in between).
    wrapped = candidate <= d.current || d.current + i >= d.players.length
    break
  }
  if (wrapped) {
    d.round += 1
    d.bankerIndex = (d.bankerIndex + 1) % d.players.length
  }
  d.current = next
  d.dice = null
  d.jailRoll = null
  d.pendingCard = null
  d.doubles = 0
  d.phase = d.players[next].inJail ? 'jailTurn' : 'roll'
  log(d, `➡️ Sıra: ${d.players[next].name}`)
}

function resolveTile(d: GameState) {
  const player = current(d)
  const tile = BOARD[player.position]

  switch (tile.type) {
    case 'start':
      log(d, `${player.name} START meydanında.`)
      finishTurn(d)
      break
    case 'buySell': {
      const card = drawCard(d)
      d.pendingCard = card
      if (card) {
        d.phase = 'cardReveal'
        log(d, `🃏 ${player.name} için kart açıldı: ${card.emoji} ${card.name}`)
      } else {
        finishTurn(d)
      }
      break
    }
    case 'casino':
      d.phase = 'casino'
      log(d, `🎰 ${player.name} kumarhaneye geldi. Bahis yapabilir ya da geçebilir.`)
      break
    case 'city': {
      const ability = d.abilityDeck.pop()
      if (ability) {
        player.abilities.push(ability)
        log(d, `🏙️ ${player.name} CITY'den özel kart kazandı!`)
      } else {
        log(d, `🏙️ ${player.name} CITY'yi ziyaret etti.`)
      }
      finishTurn(d)
      break
    }
    case 'robber': {
      const pistolIndex = player.abilities.indexOf('pistol')
      if (pistolIndex >= 0) {
        player.abilities.splice(pistolIndex, 1)
        log(d, `🔫 ${player.name} tabancasıyla soygunucuyu kovdu!`)
      } else {
        const lost = Math.floor(player.cash / 2)
        player.cash -= lost
        log(d, `🦹 ${player.name} soyuldu: ${lost.toLocaleString('tr-TR')} ₺ kaybetti.`)
      }
      finishTurn(d)
      break
    }
    case 'jail': {
      if (player.abilities.includes('lawyer')) {
        d.phase = 'jailEntry'
        log(d, `⚖️ ${player.name} avukatını kullanabilir.`)
      } else {
        enterJail(d)
        finishTurn(d)
      }
      break
    }
  }
}

function buy(d: GameState) {
  const player = current(d)
  const tile = BOARD[player.position]
  const card = d.pendingCard
  if (d.phase !== 'cardReveal' || !card || tile.type !== 'buySell') return

  const cost = card.price * (tile.multiplier ?? 1)
  if (player.cash < cost || player.items.length >= HAND_LIMIT[d.mode]) return

  player.cash -= cost
  player.items.push(card)
  d.pendingCard = null
  log(d, `🛒 ${player.name} ${card.emoji} ${card.name} kartını ${cost.toLocaleString('tr-TR')} ₺'ye aldı.`)
  if (checkWin(d)) return

  if (d.mode === 'millionaires' && player.items.length < HAND_LIMIT[d.mode]) {
    const next = drawCard(d)
    if (next) {
      d.pendingCard = next
      d.phase = 'cardReveal'
      return
    }
  }
  finishTurn(d)
}

function sell(d: GameState, cardId: string) {
  const player = current(d)
  const tile = BOARD[player.position]
  if (d.mode !== 'millionaires' || d.phase !== 'cardReveal' || tile.type !== 'buySell') return
  const index = player.items.findIndex((card) => card.id === cardId)
  if (index < 0) return

  const [card] = player.items.splice(index, 1)
  const gain = card.price * (tile.multiplier ?? 1)
  player.cash += gain
  d.discard.push(card)
  if (d.pendingCard) {
    d.discard.push(d.pendingCard)
    d.pendingCard = null
  }
  log(d, `💰 ${player.name} ${card.emoji} ${card.name} kartını ${gain.toLocaleString('tr-TR')} ₺'ye sattı.`)
  if (checkWin(d)) return
  finishTurn(d)
}

function pass(d: GameState) {
  const player = current(d)
  const tile = BOARD[player.position]

  if (d.mode === 'walletBattle' && d.phase === 'cardReveal' && tile.type === 'buySell' && d.pendingCard) {
    const cost = d.pendingCard.price * (tile.multiplier ?? 1)
    if (player.cash >= cost) return // Cüzdan Savaşı'nda almak zorunlu
    player.eliminated = true
    d.discard.unshift(d.pendingCard)
    d.pendingCard = null
    log(d, `💸 ${player.name} ödeyemediği için Milyonerler Kulübü'nden kovuldu!`)
    finishTurn(d)
    return
  }

  if (d.pendingCard) {
    d.discard.push(d.pendingCard)
    d.pendingCard = null
  }
  log(d, `${player.name} bu karede işlem yapmadı.`)
  finishTurn(d)
}

function casinoBet(d: GameState, guess: number, amount: number) {
  const player = current(d)
  if (d.phase !== 'casino') return
  if (!Number.isInteger(guess) || guess < 1 || guess > 6) return
  if (!Number.isInteger(amount) || amount < 1 || amount > player.cash) return

  const roll = rollTwo(d.seed)
  d.seed = roll.seed
  // Casino dice are NOT movement dice — never leave them in d.dice, otherwise
  // finishTurn grants an undeserved extra roll on a casino double.
  const hits = roll.dice.filter((value) => value === guess).length
  let delta = 0
  if (hits === 2) {
    delta = amount * 2
    log(d, `🎰 ${player.name} ${guess} sayısını iki zar tutturdu — 3× kazandı! (+${(amount * 2).toLocaleString('tr-TR')} ₺)`)
  } else if (hits === 1) {
    delta = amount
    log(d, `🎰 ${player.name} ${guess} sayısını tutturdu — 2× kazandı! (+${amount.toLocaleString('tr-TR')} ₺)`)
  } else {
    delta = -amount
    log(d, `🎰 ${player.name} bilemedi, ${amount.toLocaleString('tr-TR')} ₺bahis kayboldu. Zar: ${roll.dice.join(' + ')}`)
  }
  player.cash += delta
  if (checkWin(d)) return
  finishTurn(d)
}

function jailRoll(d: GameState) {
  if (d.phase !== 'jailTurn') return
  const player = current(d)
  const mine = rollDie(d.seed)
  const guard = rollDie(mine.seed)
  d.seed = guard.seed
  d.jailRoll = { player: mine.value, guard: guard.value }

  if (mine.value > guard.value) {
    player.inJail = false
    d.jailRoll = null
    d.phase = 'roll'
    d.dice = null
    log(d, `🔓 ${player.name} hapisten kaçtı (${mine.value} > ${guard.value})!`)
  } else {
    log(d, `🔒 ${player.name} hapiste kaldı (${mine.value} ≤ ${guard.value}).`)
    finishTurn(d)
  }
}

function useLawyer(d: GameState) {
  if (d.phase !== 'jailEntry' && d.phase !== 'jailTurn') return
  const player = current(d)
  const index = player.abilities.indexOf('lawyer')
  if (index < 0) return
  player.abilities.splice(index, 1)
  player.inJail = false
  d.phase = 'roll'
  d.dice = null
  log(d, `⚖️ ${player.name} avukatıyla serbest kaldı.`)
}

function acceptJail(d: GameState) {
  if (d.phase !== 'jailEntry') return
  d.phase = 'roll'
  enterJail(d)
  finishTurn(d)
}

function useTeleport(d: GameState, to: number) {
  const player = current(d)
  const index = player.abilities.indexOf('teleport')
  if (index < 0 || !Number.isInteger(to) || to < 0 || to >= BOARD.length) return
  if (d.phase !== 'roll' && d.phase !== 'jailTurn') return

  player.abilities.splice(index, 1)
  player.position = to
  player.inJail = false
  d.phase = 'roll'
  d.dice = null
  d.doubles = 0
  log(d, `🌀 ${player.name} ${to + 1}. kareye ışınlandı.`)
  if (to === 0) startBenefits(d)
  resolveTile(d)
}

function claimSeat(d: GameState, seatIndex: number, token: string) {
  if (d.phase !== 'roll') return
  const player = d.players[seatIndex]
  if (!player || (!player.claimed && player.isBot) || (player.claimed && !player.isBot)) return
  if (!token || d.players.some((p) => p.seatToken === token)) return
  player.seatToken = token
  player.isBot = false
  player.claimed = true
  log(d, `🎟️ ${player.name} oyuna katıldı.`)
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'gameOver' && action.type !== 'RESTART') return state

  if (action.type === 'RESTART') {
    if (action.actorToken && action.actorToken !== state.players[0].seatToken) return state
    const fresh = createGame({
      mode: state.mode,
      target: state.target,
      players: state.players.map((p) => ({ name: p.name, isBot: p.isBot })),
    })
    // Monotonic version: a restart must never roll online clients back to v1.
    fresh.version = state.version + 1
    return fresh
  }

  // Seat authorization: in online play every action carries the seated token.
  if (action.actorToken && action.actorToken !== current(state).seatToken) return state
  if (action.type === 'CLAIM_SEAT') {
    if (!action.token || state.players.some((p) => p.seatToken === action.token)) return state
  }

  const d = clone(state)

  switch (action.type) {
    case 'CLAIM_SEAT':
      claimSeat(d, action.seatIndex, action.token)
      break
    case 'ROLL': {
      if (d.phase !== 'roll') break
      const player = current(d)
      if (player.inJail) {
        d.phase = 'jailTurn'
        break
      }
      const roll = rollTwo(d.seed)
      d.seed = roll.seed
      d.dice = roll.dice
      const total = roll.dice[0] + roll.dice[1]
      log(d, `🎲 ${player.name}: ${roll.dice[0]} + ${roll.dice[1]} = ${total}`)

      if (roll.dice[0] === roll.dice[1]) {
        d.doubles += 1
        if (d.doubles >= 3) {
          log(d, '💥 Üçüncü çift! Hapse gidiyorsun.')
          if (current(d).abilities.includes('lawyer')) {
            current(d).position = JAIL_INDEX
            d.phase = 'jailEntry'
            log(d, '⚖️ Avukatın var — hapis cezasını önleyebilirsin.')
          } else {
            enterJail(d)
            finishTurn(d)
          }
          break
        }
      }
      movePlayer(d, total)
      resolveTile(d)
      break
    }
    case 'BUY':
      buy(d)
      break
    case 'SELL':
      sell(d, action.cardId)
      break
    case 'PASS':
      pass(d)
      break
    case 'CASINO_BET':
      casinoBet(d, action.guess, action.amount)
      break
    case 'CASINO_SKIP':
      if (d.phase !== 'casino') break
      log(d, `${current(d).name} kumarhaneyi geçti.`)
      finishTurn(d)
      break
    case 'JAIL_ROLL':
      jailRoll(d)
      break
    case 'JAIL_USE_LAWYER':
      useLawyer(d)
      break
    case 'JAIL_ACCEPT':
      acceptJail(d)
      break
    case 'USE_TELEPORT_CARD':
      useTeleport(d, action.to)
      break
  }

  // Rejected no-op actions must not bump the version or trigger a broadcast.
  if (JSON.stringify(d) === JSON.stringify(state)) return state
  d.version = state.version + 1
  return d
}
