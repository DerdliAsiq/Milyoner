import type { Ability, ItemCard } from './types'
import { shuffle } from './rng'

const PALETTE = ['#2f8fd8', '#f2912f', '#8050ad', '#63a83f', '#d9443b', '#e3c12c', '#e46280']

const DEFINITIONS: [string, string, number][] = [
  ['Araba', '🚗', 10000],
  ['Motosiklet', '🏍️', 7500],
  ['Pasta', '🍰', 2000],
  ['Şölen Tabığı', '🍽️', 3000],
  ['Altın Saat', '⌚', 10000],
  ['Bisiklet', '🚲', 5000],
  ['Kristal Küre', '🔮', 7500],
  ['Bilgisayar', '💻', 10000],
  ['Gül Demeti', '🌹', 2000],
  ['Futbol Topu', '⚽', 3000],
  ['Akıllı Telefon', '📱', 7500],
  ['Televizyon', '📺', 10000],
  ['Kahve Makinesi', '☕', 5000],
  ['Gitar', '🎸', 7500],
  ['Uçak Bileti', '✈️', 10000],
  ['Tablo', '🖼️', 5000],
  ['Mücevher Kutusu', '💎', 10000],
  ['Kitap Seti', '📚', 2000],
  ['Oyun Konsolu', '🎮', 7500],
  ['Fotoğraf Makinesi', '📷', 10000],
  ['Parfüm', '🧴', 5000],
  ['Yacht Turu', '⛵', 10000],
  ['Şampanya', '🍾', 3000],
  ['Antika Vazo', '🏺', 7500],
  ['Elektrikli Scooter', '🛴', 5000],
  ['Akıllı Saat', '⌚', 7500],
  ['Lüks Ayakkabı', '👠', 5000],
  ['Gurme Çikolata', '🍫', 2000],
  ['Heykel', '🗿', 7500],
  ['Helikopter Turu', '🚁', 10000],
  ['Piyano', '🎹', 10000],
  ['Koleksiyon Pul', '📮', 2000],
  ['Spor Şiltesi', '🧘', 3000],
  ['Drone', '🛸', 10000],
  ['Şarap Şisesi', '🍷', 3000],
  ['Kamera Objektifi', '🔭', 7500],
  ['Altın Külçe', '🪙', 10000],
  ['Çiçek Aranjmanı', '💐', 2000],
  ['Kişisel Antrenör', '🏋️', 5000],
  ['VIP Konser Bileti', '🎤', 10000],
]

export function createItemDeck(seed: number): { deck: ItemCard[]; seed: number } {
  const cards: ItemCard[] = DEFINITIONS.map(([name, emoji, price], i) => ({
    id: `item-${i}`,
    name,
    emoji,
    price,
    color: PALETTE[i % PALETTE.length],
  }))
  const result = shuffle(cards, seed)
  return { deck: result.items, seed: result.seed }
}

export function createAbilityDeck(seed: number): { deck: Ability[]; seed: number } {
  const base: Ability[] = [
    'teleport', 'teleport', 'teleport', 'teleport',
    'pistol', 'pistol', 'pistol', 'pistol',
    'lawyer', 'lawyer', 'lawyer', 'lawyer',
  ]
  const result = shuffle(base, seed)
  return { deck: result.items, seed: result.seed }
}

export const ABILITY_INFO: Record<Ability, { name: string; emoji: string; desc: string }> = {
  teleport: { name: 'Teleport', emoji: '🌀', desc: 'İstediğin kareye ışınlan (tur geliri alınmaz).' },
  pistol: { name: 'Tabanca', emoji: '🔫', desc: 'Soyguncuya karşı paranı korur.' },
  lawyer: { name: 'Avukat', emoji: '⚖️', desc: 'Hapisten kaçmanı sağlar, malların korunur.' },
}
