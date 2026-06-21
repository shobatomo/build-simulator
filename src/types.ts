export type Locale = 'en' | 'ja';
export type StatKey = 'health' | 'weaponDamage' | 'fireRate' | 'spiritPower' | 'moveSpeed' | 'stamina' | 'cooldownReduction';
export type StatBlock = Record<StatKey, number>;
export type LocalizedText = Record<Locale, string>;

export interface Hero {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  icon: string;
  baseStats: StatBlock;
  growthPerLevel: StatBlock;
}

export interface ItemEffect {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  stats: Partial<StatBlock>;
  conditional: boolean;
  defaultEnabled: boolean;
}

export interface Item {
  id: string;
  name: LocalizedText;
  category: LocalizedText;
  price: number;
  icon: string;
  stats: Partial<StatBlock>;
  effects: ItemEffect[];
}

export interface SelectedItem {
  instanceId: string;
  itemId: string;
  enabledEffectIds: string[];
}
