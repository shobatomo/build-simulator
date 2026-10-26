export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export type AssetLocale = 'english' | 'japanese';

export interface SnapshotDocument {
  endpoint: 'heroes' | 'items' | 'steam-info';
  locale: AssetLocale | null;
  clientVersion: number;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
  payload: JsonValue;
}

export interface RawAssetSnapshot {
  schemaVersion: 1;
  clientVersion: number;
  sourceBaseUrl: string;
  capturedAt: string;
  contentHash: string;
  documents: SnapshotDocument[];
}

export type ParsedValue =
  | { status: 'known'; raw: JsonValue; value: number; unit: string | null }
  | { status: 'unknown'; raw: JsonValue; reason: string };

export interface DataIssue {
  code: string;
  path: string;
  message: string;
}

export interface LocalizedTextValue {
  english: string | null;
  japanese: string | null;
}

export interface RawLocalePair {
  english: JsonObject | null;
  japanese: JsonObject | null;
}

export interface NormalizedProperty {
  key: string;
  sourceLocale: AssetLocale;
  label: LocalizedTextValue;
  value: ParsedValue;
  prefix: JsonValue;
  postfix: JsonValue;
  displayUnits: JsonValue;
  condition: { english: JsonValue; japanese: JsonValue };
  usageFlags: JsonValue;
  scaleFunction: JsonValue;
  raw: RawLocalePair;
}

export interface NormalizedUpgradeStage {
  sourceIndex: number;
  properties: Array<{
    name: string | null;
    bonus: ParsedValue;
    upgradeType: JsonValue;
    scaleStatFilter: JsonValue;
    raw: JsonValue;
  }>;
  raw: JsonValue;
}

export interface NormalizedAssetBase {
  id: string;
  className: string | null;
  name: LocalizedTextValue;
  raw: RawLocalePair;
}

export interface NormalizedHero extends NormalizedAssetBase {
  startingStats: Record<string, { value: ParsedValue; raw: JsonValue }>;
  standardLevelUpUpgrades: Record<string, ParsedValue>;
  levelInfo: JsonValue;
  scalingStats: JsonValue;
  costBonuses: JsonValue;
  legacyPurchaseBonuses: JsonValue;
  itemSlotInfo: JsonValue;
  boundItems: JsonValue;
}

export interface NormalizedItem extends NormalizedAssetBase {
  type: string | null;
  slotType: string | null;
  shopable: boolean | null;
  disabled: boolean | null;
  cost: ParsedValue;
  tier: ParsedValue;
  componentClassNames: string[] | null;
  heroIds: string[];
  properties: NormalizedProperty[];
  upgrades: NormalizedUpgradeStage[];
  weaponInfo: JsonValue;
  imbue: JsonValue;
  abilityType: JsonValue;
  updateTime: JsonValue;
}

export interface NormalizedCatalog {
  clientVersion: number;
  normalizerVersion: string;
  sourceSnapshotHash: string;
  heroes: NormalizedHero[];
  items: NormalizedItem[];
  issues: DataIssue[];
}
