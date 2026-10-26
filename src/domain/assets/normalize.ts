import type {
  DataIssue, JsonValue, NormalizedAssetBase, NormalizedCatalog,
  NormalizedHero, NormalizedItem, NormalizedProperty, NormalizedUpgradeStage,
  RawAssetSnapshot, RawLocalePair,
} from './types';
import { objectValue, parseAssetValue, textValue } from './values';

export const NORMALIZER_VERSION = '0.2.0';

// PostgreSQL jsonb reorders object keys. Object order must never change derived
// array order or locale diagnostics after a save/read/normalize round trip.
const canonicalJson = (value: JsonValue | undefined): string | undefined => {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = objectValue(value);
  return object ? '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}' : JSON.stringify(value);
};

const entityId = (value: JsonValue | undefined): string | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return null;
};

function localePairs(snapshot: RawAssetSnapshot, endpoint: 'heroes' | 'items', issues: DataIssue[]) {
  const pairs = new Map<string, RawLocalePair>();
  for (const locale of ['english', 'japanese'] as const) {
    const matches = snapshot.documents.filter((doc) => doc.endpoint === endpoint && doc.locale === locale);
    if (matches.length !== 1 || !Array.isArray(matches[0].payload)) {
      throw new Error(`Expected exactly one ${endpoint}/${locale} array document`);
    }
    for (const [index, value] of matches[0].payload.entries()) {
      const raw = objectValue(value);
      const id = raw && entityId(raw.id);
      if (!raw || id === null) {
        issues.push({ code: 'INVALID_ID', path: `${endpoint}/${locale}/${index}`, message: 'Entity retained only in the raw snapshot because its ID is invalid.' });
        continue;
      }
      const pair = pairs.get(id) ?? { english: null, japanese: null };
      if (pair[locale]) throw new Error(`Duplicate ${endpoint}/${locale} ID ${id}`);
      pair[locale] = raw;
      pairs.set(id, pair);
    }
  }
  return pairs;
}

function base(id: string, pair: RawLocalePair, path: string, issues: DataIssue[]): NormalizedAssetBase {
  const canonical = pair.english ?? pair.japanese!;
  if (!pair.english || !pair.japanese) {
    issues.push({ code: 'MISSING_LOCALE', path, message: 'Missing translation remains null; numeric interpretation uses the available locale.' });
  }
  if (pair.english && pair.japanese && pair.english.class_name !== pair.japanese.class_name) {
    issues.push({ code: 'LOCALE_IDENTITY_MISMATCH', path, message: 'Locales disagree on class_name; English identity is used.' });
  }
  return {
    id,
    className: textValue(canonical.class_name),
    name: { english: textValue(pair.english?.name), japanese: textValue(pair.japanese?.name) },
    raw: pair,
  };
}

function properties(pair: RawLocalePair, path: string, issues: DataIssue[]): NormalizedProperty[] {
  const en = objectValue(pair.english?.properties) ?? {};
  const ja = objectValue(pair.japanese?.properties) ?? {};
  return [...new Set([...Object.keys(en), ...Object.keys(ja)])].sort().map((key) => {
    const english = objectValue(en[key]);
    const japanese = objectValue(ja[key]);
    const canonical = english ?? japanese ?? {};
    const value = parseAssetValue(canonical.value);
    if (value.status === 'unknown') {
      issues.push({ code: 'UNKNOWN_VALUE', path: `${path}/properties/${key}`, message: value.reason });
    }
    if (english && japanese && canonicalJson(english.value) !== canonicalJson(japanese.value)) {
      issues.push({ code: 'LOCALIZED_VALUE_DIFFERENCE', path: `${path}/properties/${key}`, message: 'Both original values are retained; the English value is interpreted.' });
    }
    return {
      key,
      sourceLocale: english ? 'english' : 'japanese',
      label: { english: textValue(english?.label), japanese: textValue(japanese?.label) },
      value,
      prefix: canonical.prefix ?? null,
      postfix: canonical.postfix ?? null,
      displayUnits: canonical.display_units ?? null,
      condition: { english: english?.conditional ?? null, japanese: japanese?.conditional ?? null },
      usageFlags: canonical.usage_flags ?? null,
      scaleFunction: canonical.scale_function ?? null,
      raw: { english, japanese },
    };
  });
}

function upgrades(raw: JsonValue | undefined, path: string, issues: DataIssue[]): NormalizedUpgradeStage[] {
  if (!Array.isArray(raw)) {
    if (raw != null) issues.push({ code: 'UNKNOWN_UPGRADES', path, message: 'Unexpected upgrade structure remains in raw data.' });
    return [];
  }
  return raw.map((stage, sourceIndex) => {
    const entries = objectValue(stage)?.property_upgrades;
    if (!Array.isArray(entries)) issues.push({ code: 'UNKNOWN_UPGRADE_STAGE', path: `${path}/${sourceIndex}`, message: 'Stage has no property_upgrades array.' });
    return {
      sourceIndex,
      raw: stage,
      properties: (Array.isArray(entries) ? entries : []).map((entry, index) => {
        const record = objectValue(entry);
        const bonus = parseAssetValue(record?.bonus);
        if (bonus.status === 'unknown') issues.push({ code: 'UNKNOWN_UPGRADE_BONUS', path: `${path}/${sourceIndex}/${index}`, message: bonus.reason });
        return {
          name: textValue(record?.name), bonus, raw: entry,
          upgradeType: record?.upgrade_type ?? null,
          scaleStatFilter: record?.scale_stat_filter ?? null,
        };
      }),
    };
  });
}

export function normalizeSnapshot(snapshot: RawAssetSnapshot): NormalizedCatalog {
  if (snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.clientVersion) || snapshot.clientVersion <= 0) {
    throw new Error('Unsupported snapshot schema or client version');
  }
  if (snapshot.documents.some((doc) => doc.clientVersion !== snapshot.clientVersion)) {
    throw new Error('Mixed client versions cannot be normalized together');
  }
  const manifests = snapshot.documents.filter((doc) => doc.endpoint === 'steam-info');
  if (manifests.length !== 1 || objectValue(manifests[0].payload)?.client_version !== snapshot.clientVersion) {
    throw new Error('Snapshot manifest does not match its client version');
  }
  const issues: DataIssue[] = [];
  const heroes: NormalizedHero[] = [...localePairs(snapshot, 'heroes', issues)].map(([id, pair]) => {
    const raw = pair.english ?? pair.japanese!;
    return {
      ...base(id, pair, `heroes/${id}`, issues),
      startingStats: Object.fromEntries(Object.entries(objectValue(raw.starting_stats) ?? {}).map(([key, stat]) => [key, {
        value: parseAssetValue(objectValue(stat)?.value), raw: stat,
      }])),
      standardLevelUpUpgrades: Object.fromEntries(Object.entries(objectValue(raw.standard_level_up_upgrades) ?? {}).map(([key, value]) => [key, parseAssetValue(value)])),
      levelInfo: raw.level_info ?? null,
      scalingStats: raw.scaling_stats ?? null,
      costBonuses: raw.cost_bonuses ?? null,
      legacyPurchaseBonuses: raw.purchase_bonuses ?? null,
      itemSlotInfo: raw.item_slot_info ?? null,
      boundItems: raw.items ?? null,
    };
  });
  const items: NormalizedItem[] = [...localePairs(snapshot, 'items', issues)].map(([id, pair]) => {
    const raw = pair.english ?? pair.japanese!;
    const components = raw.component_items;
    if (components != null && (!Array.isArray(components) || components.some((entry) => typeof entry !== 'string'))) {
      issues.push({ code: 'UNKNOWN_COMPONENTS', path: `items/${id}/component_items`, message: 'Invalid component references retained in raw data.' });
    }
    const rawHeroIds = [raw.hero, ...(Array.isArray(raw.heroes) ? raw.heroes : [])];
    return {
      ...base(id, pair, `items/${id}`, issues),
      type: textValue(raw.type), slotType: textValue(raw.item_slot_type),
      shopable: typeof raw.shopable === 'boolean' ? raw.shopable : null,
      disabled: typeof raw.disabled === 'boolean' ? raw.disabled : null,
      cost: parseAssetValue(raw.cost), tier: parseAssetValue(raw.item_tier),
      componentClassNames: Array.isArray(components) && components.every((entry) => typeof entry === 'string') ? components : null,
      heroIds: [...new Set(rawHeroIds.map(entityId).filter((value): value is string => value !== null))],
      properties: properties(pair, `items/${id}`, issues),
      upgrades: upgrades(raw.upgrades, `items/${id}/upgrades`, issues),
      weaponInfo: raw.weapon_info ?? null,
      imbue: raw.imbue ?? null,
      abilityType: raw.ability_type ?? null,
      updateTime: raw.update_time ?? null,
    };
  });
  // No shop/disabled filter: weapons, abilities and hidden components remain available.
  return { clientVersion: snapshot.clientVersion, normalizerVersion: NORMALIZER_VERSION, sourceSnapshotHash: snapshot.contentHash, heroes, items, issues };
}
