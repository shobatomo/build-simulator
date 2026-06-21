import type { Hero, Item } from '../types';

export const heroes: Hero[] = [
  { id: 'ivy', name: { en: 'Ivy', ja: 'アイビー' }, role: { en: 'Mobile support', ja: '機動支援' }, icon: '🦉', baseStats: { health: 550, weaponDamage: 26, fireRate: 4, spiritPower: 0, moveSpeed: 7.3, stamina: 3, cooldownReduction: 0 }, growthPerLevel: { health: 34, weaponDamage: 1.5, fireRate: 0.06, spiritPower: 0.8, moveSpeed: 0.01, stamina: 0, cooldownReduction: 0 } },
  { id: 'abrams', name: { en: 'Abrams', ja: 'エイブラムス' }, role: { en: 'Frontline brawler', ja: '前線ファイター' }, icon: '🛡️', baseStats: { health: 650, weaponDamage: 29, fireRate: 3.4, spiritPower: 0, moveSpeed: 6.8, stamina: 3, cooldownReduction: 0 }, growthPerLevel: { health: 42, weaponDamage: 1.8, fireRate: 0.04, spiritPower: 0.65, moveSpeed: 0.01, stamina: 0, cooldownReduction: 0 } },
  { id: 'haze', name: { en: 'Haze', ja: 'ヘイズ' }, role: { en: 'Weapon assassin', ja: '武器アサシン' }, icon: '🌫️', baseStats: { health: 500, weaponDamage: 28, fireRate: 4.5, spiritPower: 0, moveSpeed: 7.4, stamina: 3, cooldownReduction: 0 }, growthPerLevel: { health: 30, weaponDamage: 2.1, fireRate: 0.08, spiritPower: 0.55, moveSpeed: 0.01, stamina: 0, cooldownReduction: 0 } },
];

export const items: Item[] = [
  { id: 'basic-magazine', name: { en: 'Basic Magazine', ja: 'ベーシックマガジン' }, category: { en: 'Weapon', ja: '武器' }, price: 500, icon: '📎', stats: { weaponDamage: 6, fireRate: 0.25 }, effects: [] },
  { id: 'enduring-spirit', name: { en: 'Enduring Spirit', ja: 'エンデュアリングスピリット' }, category: { en: 'Vitality', ja: '耐久' }, price: 500, icon: '💚', stats: { health: 120, spiritPower: 4 }, effects: [{ id: 'lifesteal-active', name: { en: 'Sustained fight', ja: '継戦' }, description: { en: 'Toggle when its sustain bonus should be counted.', ja: 'サステインボーナスを計算に含める場合に有効化します。' }, stats: { health: 40 }, conditional: true, defaultEnabled: false }] },
  { id: 'extra-stamina', name: { en: 'Extra Stamina', ja: 'エクストラスタミナ' }, category: { en: 'Vitality', ja: '耐久' }, price: 500, icon: '🏃', stats: { stamina: 1, moveSpeed: 0.3 }, effects: [] },
  { id: 'mystic-burst', name: { en: 'Mystic Burst', ja: 'ミスティックバースト' }, category: { en: 'Spirit', ja: 'スピリット' }, price: 1250, icon: '✨', stats: { spiritPower: 12 }, effects: [{ id: 'burst-window', name: { en: 'Burst proc', ja: 'バースト発動' }, description: { en: 'Enable when the burst condition is active.', ja: 'バースト条件が成立している場合に有効化します。' }, stats: { spiritPower: 8 }, conditional: true, defaultEnabled: false }] },
];
