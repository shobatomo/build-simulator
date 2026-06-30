import type {
  AssetIcons,
  Hero,
  HeroAbility,
  HeroAbilityProperty,
  Item,
  ItemPropertyTag,
  LocalizedText,
  StatBlock,
  StatKey,
} from '../../../types';

// Base URL and paths are defined by server/api-1.json (OpenAPI).
export const DEADLOCK_API_BASE = process.env.DEADLOCK_API_BASE_URL ?? 'https://api.deadlock-api.com/v1/assets';

export type JsonRecord = Record<string, unknown>;

export const SERVER_HTTP_HEADERS = {
  'X-App-Name': 'deadlock-build-simulator',
} as const satisfies Record<string, string>;

interface RawHeroDescription {
  lore?: string | null;
  playstyle?: string | null;
  role?: string | null;
}

export interface RawHero {
  id: number;
  class_name: string;
  name: string;
  description?: RawHeroDescription | null;
  images?: Record<string, string | null | undefined> | null;
  items?: Record<string, string | undefined> | null;
  starting_stats?: Record<string, { value?: number | null } | undefined> | null;
  standard_level_up_upgrades?: Record<string, number | undefined> | null;
}

interface RawItemProperty {
  value?: string | number | null;
  label?: string | null;
  prefix?: string | null;
  postfix?: string | null;
  icon?: string | null;
  tooltip_section?: string | null;
  tooltip_is_elevated?: boolean | null;
  tooltip_is_important?: boolean | null;
  conditional?: string | null;
  usage_flags?: string[] | null;
}

interface RawItemDescription {
  active?: string | null;
  desc?: string | null;
  desc2?: string | null;
  passive?: string | null;
}

interface RawTooltipSectionAttribute {
  properties?: string[] | null;
  elevated_properties?: string[] | null;
  important_properties?: string[] | null;
  important_properties_with_icon?: Array<{ name?: string | null }> | null;
}

interface RawWeaponInfo {
  bullets?: number | null;
  damage_per_shot?: number | null;
  shots_per_second?: number | null;
  range?: string | number | null;
}

export interface RawItem {
  id: number;
  class_name: string;
  name: string;
  type: string;
  item_slot_type?: 'weapon' | 'vitality' | 'spirit' | null;
  item_tier?: number | null;
  activation?: string | null;
  is_active_item?: boolean;
  shopable?: boolean;
  cost?: number | null;
  hero?: number | null;
  heroes?: number[] | null;
  ability_type?: string | null;
  description?: RawItemDescription | null;
  properties?: Record<string, RawItemProperty | undefined> | null;
  tooltip_sections?: Array<{
    section_attributes?: RawTooltipSectionAttribute[] | null;
  }> | null;
  image?: string | null;
  image_webp?: string | null;
  shop_image?: string | null;
  shop_image_webp?: string | null;
  shop_image_small?: string | null;
  shop_image_small_webp?: string | null;
  weapon_info?: RawWeaponInfo | null;
}

const emptyStats = (): StatBlock => ({
  health: 0,
  weaponDamage: 0,
  fireRate: 0,
  spiritPower: 0,
  moveSpeed: 0,
  stamina: 0,
  cooldownReduction: 0,
  lightMeleeDamage: 0,
  heavyMeleeDamage: 0,
  range: 0,
});

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const decodeHtmlEntities = (value: string) => {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
};

const stripDescriptionTags = (value: string) =>
  decodeHtmlEntities(value)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|li|p)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const fetchAsset = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${DEADLOCK_API_BASE}/${path}`, {
    headers: SERVER_HTTP_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

const heroStats = (hero: RawHero, weapon?: RawItem): StatBlock => {
  const value = (key: string) => hero.starting_stats?.[key]?.value ?? 0;
  return {
    ...emptyStats(),
    health: value('max_health'),
    weaponDamage: weapon?.weapon_info?.damage_per_shot ?? value('weapon_power'),
    fireRate: weapon?.weapon_info?.shots_per_second ?? 0,
    moveSpeed: value('max_move_speed'),
    stamina: value('stamina'),
    lightMeleeDamage: value('light_melee_damage'),
    heavyMeleeDamage: value('heavy_melee_damage'),
    range: parseNumber(weapon?.weapon_info?.range),
  };
};

const heroGrowthStats = (hero: RawHero, weapon?: RawItem): StatBlock => {
  const upgrade = (key: string) => hero.standard_level_up_upgrades?.[key] ?? 0;
  const meleeGrowth = upgrade('MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL');
  const lightMeleeDamage = hero.starting_stats?.light_melee_damage?.value ?? 0;
  const heavyMeleeDamage = hero.starting_stats?.heavy_melee_damage?.value ?? 0;
  const heavyMeleeRatio = lightMeleeDamage > 0 ? heavyMeleeDamage / lightMeleeDamage : 1;
  return {
    ...emptyStats(),
    health: upgrade('MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL'),
    weaponDamage:
      upgrade('MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL') * (weapon?.weapon_info?.bullets ?? 1),
    spiritPower: upgrade('MODIFIER_VALUE_TECH_POWER'),
    lightMeleeDamage: meleeGrowth,
    heavyMeleeDamage: meleeGrowth * heavyMeleeRatio,
    range: upgrade('MODIFIER_VALUE_BONUS_ATTACK_RANGE'),
  };
};

const abilityPropertySummaries = (english: RawItem, japanese: RawItem): HeroAbilityProperty[] => {
  const entries = Object.entries(english.properties ?? {}).filter(([, property]) => property?.label || property?.value != null);
  return entries.map(([id, property]) => {
    const japaneseProperty = japanese.properties?.[id] ?? property;
    return {
      id,
      label: {
        en: property?.label ?? id,
        ja: japaneseProperty?.label ?? property?.label ?? id,
      },
      value: {
        en: propertyValue(property),
        ja: propertyValue(japaneseProperty) || propertyValue(property),
      },
      numericValue: parseNumber(property?.value),
      unit:
        property?.postfix || japaneseProperty?.postfix
          ? {
              en: property?.postfix ?? '',
              ja: japaneseProperty?.postfix ?? property?.postfix ?? '',
            }
          : undefined,
    };
  });
};

const heroAbilities = (hero: RawHero, englishItems: RawItem[], japaneseItems: RawItem[]): HeroAbility[] => {
  const abilityClassNames = new Set(
    Object.values(hero.items ?? {}).filter((value): value is string => typeof value === 'string'),
  );
  const japaneseById = new Map(japaneseItems.filter((item) => item.type === 'ability').map((item) => [item.id, item]));
  return englishItems
    .filter((item) => item.type === 'ability')
    .filter(
      (item) =>
        abilityClassNames.has(item.class_name) ||
        item.hero === hero.id ||
        (item.heroes ?? []).includes(hero.id),
    )
    .map((item) => {
      const japanese = japaneseById.get(item.id) ?? item;
      return {
        id: String(item.id),
        name: { en: item.name, ja: japanese.name ?? item.name },
        description: {
          en: itemDescription(item),
          ja: itemDescription(japanese) || itemDescription(item),
        },
        icon:
          item.image_webp ??
          item.image ??
          item.shop_image_webp ??
          item.shop_image ??
          item.shop_image_small_webp ??
          item.shop_image_small ??
          '🪄',
        abilityType: item.ability_type ?? '',
        properties: abilityPropertySummaries(item, japanese),
      };
    });
};

export const formatHeroData = (
  englishHeroes: RawHero[],
  japaneseHeroes: RawHero[],
  englishItems: RawItem[],
  japaneseItems: RawItem[],
): Hero[] => {
  const japaneseById = new Map(japaneseHeroes.map((hero) => [hero.id, hero]));
  return englishHeroes.map((hero) => {
    const japanese = japaneseById.get(hero.id);
    const primaryWeaponClass = hero.items?.weapon_primary;
    const weapon = englishItems.find(
      (item) =>
        item.type === 'weapon' &&
        (item.class_name === primaryWeaponClass || (!primaryWeaponClass && item.hero === hero.id)),
    );
    return {
      id: String(hero.id),
      name: { en: hero.name, ja: japanese?.name ?? hero.name },
      role: {
        en: hero.description?.role ?? hero.description?.playstyle ?? '',
        ja: japanese?.description?.role ?? japanese?.description?.playstyle ?? hero.description?.role ?? '',
      },
      icon:
        hero.images?.icon_image_small_webp ??
        hero.images?.icon_image_small ??
        hero.images?.icon_hero_card_webp ??
        hero.images?.icon_hero_card ??
        '🧙',
      baseStats: heroStats(hero, weapon),
      growthPerLevel: heroGrowthStats(hero, weapon),
      abilities: heroAbilities(hero, englishItems, japaneseItems),
    };
  });
};

const isExplicitlyConditionalProperty = (property?: RawItemProperty) =>
  property?.usage_flags?.includes('ConditionallyApplied') === true ||
  Boolean(property?.conditional);

const isConditionalProperty = (item: RawItem, property?: RawItemProperty) => {
  // Valve marks some innate bonuses as ConditionallyApplied internally even
  // though they are always granted by owning the item (for example Echo Shard's
  // innate fire rate). The tooltip section is the authoritative UI behavior.
  if (property?.tooltip_section === 'innate') return false;
  if (item.is_active_item === true && property?.tooltip_section === 'active') return true;
  return isExplicitlyConditionalProperty(property);
};

const itemPropertyStatKeys: Partial<Record<string, StatKey>> = {
  MaxHealth: 'health',
  BonusHealth: 'health',
  BonusBaseHealth: 'health',
  BonusHealthPercent: 'health',
  MaxHealthPercent: 'health',
  BaseAttackDamagePercent: 'weaponDamage',
  WeaponPower: 'weaponDamage',
  BonusFireRate: 'fireRate',
  FireRateBonus: 'fireRate',
  FireRatePercent: 'fireRate',
  TechPower: 'spiritPower',
  TechPowerPercent: 'spiritPower',
  BonusMoveSpeed: 'moveSpeed',
  BonusSprintSpeed: 'moveSpeed',
  MoveSpeed: 'moveSpeed',
  BonusMoveSpeedPercent: 'moveSpeed',
  MoveSpeedPercent: 'moveSpeed',
  BonusStamina: 'stamina',
  Stamina: 'stamina',
  BonusStaminaPercent: 'stamina',
  StaminaPercent: 'stamina',
  CooldownReduction: 'cooldownReduction',
  TechCooldownReduction: 'cooldownReduction',
  BonusHeavyMeleeDamage: 'heavyMeleeDamage',
  BonusMeleeDamagePercent: 'lightMeleeDamage',
  BonusAttackRangePercent: 'range',
};

const mapItemStats = (
  properties?: RawItem['properties'],
  shouldInclude: (property?: RawItemProperty) => boolean = () => true,
): Partial<StatBlock> => {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const property = properties?.[key];
      if (!shouldInclude(property)) continue;
      const value = parseNumber(property?.value);
      if (value !== 0) return value;
    }
    return 0;
  };

  return {
    health: get('MaxHealth', 'BonusHealth', 'BonusBaseHealth'),
    spiritPower: get('TechPower'),
    moveSpeed: get('BonusMoveSpeed', 'BonusSprintSpeed', 'MoveSpeed'),
    stamina: get('BonusStamina', 'Stamina'),
    cooldownReduction: get('CooldownReduction', 'TechCooldownReduction'),
    heavyMeleeDamage: get('BonusHeavyMeleeDamage'),
  };
};

const mapItemPercentageStats = (
  properties?: RawItem['properties'],
  shouldInclude: (property?: RawItemProperty) => boolean = () => true,
): Partial<StatBlock> => {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const property = properties?.[key];
      if (!shouldInclude(property)) continue;
      const value = parseNumber(property?.value);
      if (value !== 0 && (property?.postfix === '%' || key.toLowerCase().includes('percent'))) return value;
    }
    return 0;
  };

  return {
    health: get('BonusHealthPercent', 'MaxHealthPercent'),
    weaponDamage: get('BaseAttackDamagePercent', 'WeaponPower'),
    fireRate: get('BonusFireRate', 'FireRateBonus', 'FireRatePercent'),
    spiritPower: get('TechPowerPercent'),
    moveSpeed: get('BonusMoveSpeedPercent', 'MoveSpeedPercent'),
    stamina: get('BonusStaminaPercent', 'StaminaPercent'),
    lightMeleeDamage: get('BonusMeleeDamagePercent'),
    heavyMeleeDamage: get('BonusMeleeDamagePercent'),
    range: get('BonusAttackRangePercent'),
  };
};

const tooltipPropertyNames = (item: RawItem) => {
  const names = new Set<string>();
  for (const section of item.tooltip_sections ?? []) {
    for (const attributes of section.section_attributes ?? []) {
      for (const name of attributes.properties ?? []) names.add(name);
      for (const name of attributes.elevated_properties ?? []) names.add(name);
      for (const name of attributes.important_properties ?? []) names.add(name);
      for (const property of attributes.important_properties_with_icon ?? []) {
        if (property.name) names.add(property.name);
      }
    }
  }
  if (names.size === 0) {
    for (const [name, property] of Object.entries(item.properties ?? {})) {
      if (property?.tooltip_section || property?.tooltip_is_elevated || property?.tooltip_is_important) names.add(name);
    }
  }
  return [...names];
};

const emphasizedPropertyNames = (item: RawItem) => {
  const names = new Set<string>();
  for (const section of item.tooltip_sections ?? []) {
    for (const attributes of section.section_attributes ?? []) {
      for (const name of attributes.elevated_properties ?? []) names.add(name);
      for (const name of attributes.important_properties ?? []) names.add(name);
      for (const property of attributes.important_properties_with_icon ?? []) {
        if (property.name) names.add(property.name);
      }
    }
  }
  return names;
};

const propertyValue = (property?: RawItemProperty) => {
  if (!property || property.value == null) return '';
  const value = String(property.value);
  const numericValue = parseNumber(property.value);
  const prefix =
    property.prefix === '{s:sign}'
      ? numericValue > 0
        ? '+'
        : ''
      : property.prefix && !value.startsWith(property.prefix)
        ? property.prefix
        : '';
  const postfix = property.postfix && !value.endsWith(property.postfix) ? property.postfix : '';
  return `${prefix}${value}${postfix}`;
};

const itemPropertyTags = (english: RawItem, japanese: RawItem): ItemPropertyTag[] => {
  const emphasizedNames = emphasizedPropertyNames(english);
  return tooltipPropertyNames(english)
    .flatMap((name): ItemPropertyTag[] => {
      const statKey = itemPropertyStatKeys[name];
      const englishProperty = english.properties?.[name];
      const japaneseProperty = japanese.properties?.[name] ?? englishProperty;
      const englishValue = propertyValue(englishProperty);
      const japaneseValue = propertyValue(japaneseProperty) || englishValue;
      if (!englishProperty?.label || !englishValue) return [];

      const englishCondition = englishProperty.conditional ?? '';
      const japaneseCondition = japaneseProperty?.conditional ?? englishCondition;
      const tag: ItemPropertyTag = {
        id: name,
        label: {
          en: englishProperty.label,
          ja: japaneseProperty?.label ?? englishProperty.label,
        },
        value: { en: englishValue, ja: japaneseValue },
        numericValue: parseNumber(englishProperty.value),
        unit:
          englishProperty.postfix || japaneseProperty?.postfix
            ? {
                en: englishProperty.postfix ?? '',
                ja: japaneseProperty?.postfix ?? englishProperty.postfix ?? '',
              }
            : undefined,
        statKey,
        // Innate properties remain visible. Only explicitly conditional tags,
        // plus the active section of an active item, follow the checkbox.
        activationEffectId: isConditionalProperty(english, englishProperty)
          ? `${english.id}-description`
          : undefined,
        condition:
          englishCondition || japaneseCondition
            ? { en: englishCondition, ja: japaneseCondition }
            : undefined,
        icon: japaneseProperty?.icon ?? englishProperty.icon ?? undefined,
        emphasized:
          emphasizedNames.has(name) ||
          englishProperty.tooltip_is_elevated === true ||
          englishProperty.tooltip_is_important === true,
      };
      return [tag];
    });
};

const itemDescription = (item: RawItem) => {
  const description = item.description;
  const parts = [description?.desc, description?.desc2, description?.passive, description?.active]
    .filter((part): part is string => Boolean(part))
    .map(stripDescriptionTags);
  return [...new Set(parts)].join('\n\n');
};

const categoryLabels: Record<'weapon' | 'vitality' | 'spirit', LocalizedText> = {
  weapon: { en: 'Weapon', ja: '武器' },
  vitality: { en: 'Vitality', ja: '耐久' },
  spirit: { en: 'Spirit', ja: 'スピリット' },
};

export const formatItemData = (englishItems: RawItem[], japaneseItems: RawItem[]): Item[] => {
  const japaneseById = new Map(japaneseItems.map((item) => [item.id, item]));
  return englishItems
    .filter(
      (item): item is RawItem & { item_slot_type: 'weapon' | 'vitality' | 'spirit' } =>
        item.type === 'upgrade' && item.shopable === true && Boolean(item.item_slot_type),
    )
    .map((item) => {
      const japanese = japaneseById.get(item.id) ?? item;
      const labels = categoryLabels[item.item_slot_type];
      const tier = item.item_tier ? ` · Tier ${item.item_tier}` : '';
      const japaneseTier = item.item_tier ? ` · ティア${item.item_tier}` : '';
      const description = {
        en: itemDescription(item),
        ja: itemDescription(japanese) || itemDescription(item),
      };
      const isConditional = (property?: RawItemProperty) =>
        isConditionalProperty(item, property);
      const conditionalStats = mapItemStats(item.properties, isConditional);
      const conditionalPercentageStats = mapItemPercentageStats(
        item.properties,
        isConditional,
      );
      const hasConditionalProperties = Object.values(item.properties ?? {}).some(
        isConditional,
      );
      const hasConditionalStats = [conditionalStats, conditionalPercentageStats].some(
        (stats) => Object.values(stats).some((value) => value !== 0),
      );
      return {
        id: String(item.id),
        name: { en: item.name, ja: japanese.name ?? item.name },
        category: { en: `${labels.en}${tier}`, ja: `${labels.ja}${japaneseTier}` },
        slotType: item.item_slot_type,
        tier: item.item_tier ?? undefined,
        price: item.cost ?? 0,
        icon:
          item.shop_image_small_webp ??
          item.shop_image_webp ??
          item.shop_image_small ??
          item.shop_image ??
          item.image_webp ??
          item.image ??
          '📦',
        description,
        stats: mapItemStats(item.properties, (property) => !isConditional(property)),
        percentageStats: mapItemPercentageStats(
          item.properties,
          (property) => !isConditional(property),
        ),
        propertyTags: itemPropertyTags(item, japanese),
        effects: description.en || description.ja || hasConditionalStats
          ? [
              {
                id: `${item.id}-description`,
                name: item.is_active_item
                  ? { en: 'Active effect', ja: 'アクティブ効果' }
                  : hasConditionalProperties
                    ? { en: 'Conditional bonus', ja: '条件付きボーナス' }
                  : { en: 'Passive effect', ja: 'パッシブ効果' },
                description,
                stats: conditionalStats,
                percentageStats: conditionalPercentageStats,
                conditional: item.is_active_item === true || hasConditionalProperties,
                defaultEnabled: false,
              },
            ]
          : [],
      };
    });
};

const nestedString = (root: JsonRecord, path: string[]) => {
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as JsonRecord)[key];
  }
  return typeof current === 'string' ? current : undefined;
};

export const selectAssetIcons = (icons: JsonRecord): AssetIcons => ({
  price: nestedString(icons, ['gold.svg']),
  categories: {
    weapon: nestedString(icons, ['builds', 'citadel_build_tag_weapon.svg']),
    vitality: nestedString(icons, ['builds', 'citadel_build_tag_vitality.svg']),
    spirit: nestedString(icons, ['builds', 'citadel_build_tag_spirit.svg']),
  },
  stats: {
    health: nestedString(icons, ['icons', 'properties', 'health.svg']),
    weaponDamage: nestedString(icons, ['icons', 'properties', 'damage_weapon_color.svg']),
    fireRate: nestedString(icons, ['icons', 'properties', 'fire_rate.svg']),
    spiritPower: nestedString(icons, ['icons', 'properties', 'spirit.svg']),
    moveSpeed: nestedString(icons, ['icons', 'properties', 'move_speed.svg']),
    stamina: nestedString(icons, ['icons', 'properties', 'move_stamina.svg']),
    cooldownReduction: nestedString(icons, ['icons', 'properties', 'cooldown.svg']),
  },
});

export const loadDeadlockRawAssets = async () => {
  const [englishHeroes, japaneseHeroes, englishItems, japaneseItems, icons] = await Promise.all([
    fetchAsset<RawHero[]>('heroes?language=english&only_active=true'),
    fetchAsset<RawHero[]>('heroes?language=japanese&only_active=true'),
    fetchAsset<RawItem[]>('items?language=english'),
    fetchAsset<RawItem[]>('items?language=japanese'),
    fetchAsset<JsonRecord>('icons'),
  ]);

  return { englishHeroes, japaneseHeroes, englishItems, japaneseItems, icons };
};

export const formatDeadlockData = ({
  englishHeroes,
  japaneseHeroes,
  englishItems,
  japaneseItems,
  icons,
}: Awaited<ReturnType<typeof loadDeadlockRawAssets>>) => ({
    heroes: formatHeroData(englishHeroes, japaneseHeroes, englishItems, japaneseItems),
    items: formatItemData(englishItems, japaneseItems),
    assets: {
      icons: selectAssetIcons(icons),
      source: `${DEADLOCK_API_BASE}/icons`,
    },
    metadata: {
      source: DEADLOCK_API_BASE,
      endpoints: ['heroes', 'items', 'icons'],
    },
  });

export const loadDeadlockData = async () => formatDeadlockData(await loadDeadlockRawAssets());
