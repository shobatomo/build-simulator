import type { Hero, Item, SelectedItem, StatBlock } from '../types';

export const statLabels = {
  health: { en: 'Health', ja: '体力' },
  weaponDamage: { en: 'Weapon Damage', ja: '武器ダメージ' },
  fireRate: { en: 'Fire Rate', ja: '連射速度' },
  spiritPower: { en: 'Spirit Power', ja: 'スピリットパワー' },
  moveSpeed: { en: 'Move Speed', ja: '移動速度' },
  stamina: { en: 'Stamina', ja: 'スタミナ' },
  cooldownReduction: { en: 'Cooldown Reduction', ja: 'クールダウン短縮' },
} as const;

export const statKeys = Object.keys(statLabels) as Array<keyof StatBlock>;

const emptyStats = (): StatBlock => ({ health: 0, weaponDamage: 0, fireRate: 0, spiritPower: 0, moveSpeed: 0, stamina: 0, cooldownReduction: 0 });

const addStats = (target: StatBlock, source: Partial<StatBlock>) => {
  statKeys.forEach((key) => {
    target[key] += source[key] ?? 0;
  });
};

export const calculateStats = (hero: Hero, level: number, selectedItems: SelectedItem[], allItems: Item[]) => {
  const totals = emptyStats();
  addStats(totals, hero.baseStats);
  statKeys.forEach((key) => {
    totals[key] += hero.growthPerLevel[key] * Math.max(level - 1, 0);
  });

  selectedItems.forEach((selected) => {
    const item = allItems.find((candidate) => candidate.id === selected.itemId);
    if (!item) return;
    addStats(totals, item.stats);
    item.effects.forEach((effect) => {
      if (!effect.conditional || selected.enabledEffectIds.includes(effect.id)) {
        addStats(totals, effect.stats);
      }
    });
  });

  return totals;
};
