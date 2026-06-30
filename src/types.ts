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

export interface HeroAbilityPropertyScaleFunction {
  className?: string;
  subclassName?: string;
  specificStatScaleType?: string;
  statScale?: number;
}

export interface HeroAbilityProperty {
  id: string;
  label: LocalizedText;
  value: LocalizedText;
  numericValue: number;
  unit?: LocalizedText;
  cssClass?: string;
  scaleFunction?: HeroAbilityPropertyScaleFunction;
}

export interface HeroAbility {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  abilityType: string;
  properties: HeroAbilityProperty[];
}

export interface Hero {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  icon: string;
  baseStats: StatBlock;
  growthPerLevel: StatBlock;
  abilities?: HeroAbility[];
}

export interface ItemEffect {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  stats: Partial<StatBlock>;
  percentageStats?: Partial<StatBlock>;
  conditional: boolean;
  defaultEnabled: boolean;
}

export interface ItemPropertyTag {
  id: string;
  label: LocalizedText;
  value: LocalizedText;
  numericValue?: number;
  unit?: LocalizedText;
  statKey?: StatKey;
  activationEffectId?: string;
  condition?: LocalizedText;
  icon?: string;
  emphasized: boolean;
}

export interface Item {
  id: string;
  name: LocalizedText;
  category: LocalizedText;
  slotType?: 'weapon' | 'vitality' | 'spirit';
  tier?: number;
  price: number;
  icon: string;
  description?: LocalizedText;
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
