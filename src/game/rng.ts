/** Deterministic, seedable PRNG (mulberry32). Keeps online play reproducible. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, seed: t | 0 }
}

export function rollDie(seed: number): { value: number; seed: number } {
  const r = nextRandom(seed)
  return { value: Math.floor(r.value * 6) + 1, seed: r.seed }
}

export function rollTwo(seed: number): { dice: [number, number]; seed: number } {
  const a = rollDie(seed)
  const b = rollDie(a.seed)
  return { dice: [a.value, b.value], seed: b.seed }
}

export function shuffle<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const copy = [...items]
  let s = seed
  for (let i = copy.length - 1; i > 0; i--) {
    const r = nextRandom(s)
    s = r.seed
    const j = Math.floor(r.value * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return { items: copy, seed: s }
}
