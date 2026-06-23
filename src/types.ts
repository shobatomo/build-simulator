export type Locale = 'en' | 'ja';
export type StatKey =
  | 'health'
  | 'weaponDamage'
  | 'fireRate'
  | 'spiritPower'
  | 'moveSpeed'
  | 'stamina'
  | 'cooldownReduction'
  | 'lightMeleeDamage'
  | 'heavyMeleeDamage'
  | 'range';
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

export interface ItemPropertyTag {
  id: string;
  label: LocalizedText;
  value: LocalizedText;
  condition?: LocalizedText;
  icon?: string;
  emphasized: boolean;
}

export interface Item {
  id: string;
  name: LocalizedText;
  category: LocalizedText;
  slotType?: 'weapon' | 'vitality' | 'spirit';
  price: number;
  icon: string;
  stats: Partial<StatBlock>;
  percentageStats?: Partial<StatBlock>;
  propertyTags?: ItemPropertyTag[];
  effects: ItemEffect[];
}

export interface AssetIcons {
  price?: string;
  categories: Partial<Record<'weapon' | 'vitality' | 'spirit', string>>;
  stats: Partial<Record<StatKey, string>>;
}

export interface SelectedItem {
  instanceId: string;
  itemId: string;
  enabledEffectIds: string[];
}
