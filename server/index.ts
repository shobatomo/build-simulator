import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { heroes, items } from './mockApiData.js';
import type { Hero, Item, LocalizedText, StatBlock } from '../src/types.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const DEADLOCK_API_BASE = 'https://deadlock.io/api/v1';
const DEADLOCK_ASSET_BASE = 'https://deadlock.io';
const INITIAL_ENDPOINTS = ['manifest', 'heroes', 'items', 'abilities', 'assets', 'globals', 'sources'] as const;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.get('/api/heroes', (_request, response) => response.json({ data: heroes, source: 'mock' }));
app.get('/api/items', (_request, response) => response.json({ data: items, source: 'mock' }));

app.post('/api/sync/deadlock-data', (_request, response) => {
  response.status(501).json({
    message: 'External Deadlock data sync is intentionally stubbed until a trusted API source and Supabase credentials are configured.',
    recommendedSchedule: 'weekly',
  });
});

app.get('/api/sync/deadlock-data-first', async (_request, response) => {
  try {
    const deadlockData = await fetchInitialDeadlockData();

    response.json({
      heroes: formatHeroData(deadlockData.heroes),
      items: formatItemData(deadlockData.items, deadlockData.abilities),
      assets: {
        baseUrl: DEADLOCK_ASSET_BASE,
        manifest: deadlockData.assets,
        heroes: collectAssets(deadlockData.heroes.heroes),
        items: collectAssets(deadlockData.items.items),
        abilities: collectAssets(getArrayFromResponse(deadlockData.abilities, 'abilities')),
      },
      metadata: {
        manifest: deadlockData.manifest,
        sources: deadlockData.sources,
        fetchedEndpoints: INITIAL_ENDPOINTS,
      },
      rawData: deadlockData,
    });
  } catch (error) {
    console.error(`データ取得中にエラーが発生しました。: ${error}`);
    response.status(500).json({
      error: `データの取得に失敗しました。${error}`,
    });
  }
});

type DeadlockDataType = (typeof INITIAL_ENDPOINTS)[number];

type JsonRecord = Record<string, unknown>;

type DeadlockInitialData = {
  [Key in DeadlockDataType]: Key extends 'heroes'
    ? RawHeroesResponse
    : Key extends 'items'
      ? RawItemsResponse
      : JsonRecord;
};

interface RawLocalizedText {
  english?: string | null;
  byLanguage?: {
    english?: string | null;
    japanese?: string | null;
  } | null;
}

interface RawAsset {
  publicPath?: string | null;
  path?: string | null;
  url?: string | null;
  type?: string | null;
}

interface RawHero {
  id?: string | number;
  slug?: string;
  heroId?: string | number;
  codeName?: string;
  displayName?: RawLocalizedText | string | null;
  name?: RawLocalizedText | string | null;
  playstyle?: RawLocalizedText | string | null;
  description?: RawLocalizedText | string | null;
  stats?: JsonRecord | null;
  baseStats?: JsonRecord | null;
  scalingStats?: JsonRecord | null;
  growthPerLevel?: JsonRecord | null;
  weaponStats?: JsonRecord | null;
  abilities?: unknown[] | JsonRecord | null;
  tags?: unknown[] | null;
  assets?: Record<string, RawAsset | string | undefined> | null;
}

interface RawItem {
  id?: string;
  slug?: string;
  displayName?: RawLocalizedText | string | null;
  name?: RawLocalizedText | string | null;
  description?: RawLocalizedText | string | null;
  kind?: string;
  shop?: {
    category?: string | null;
    tierLabel?: string | null;
    cost?: number | string | null;
    isPublicShopItem?: boolean;
  } | null;
  properties?: Record<string, { value?: string | number | null } | string | number | undefined> | null;
  activation?: { isActive?: boolean; isPassive?: boolean } | null;
  ability?: string | JsonRecord | null;
  abilities?: Array<string | JsonRecord> | JsonRecord | null;
  tooltip?: JsonRecord | null;
  assets?: Record<string, RawAsset | string | undefined> | null;
}

interface RawHeroesResponse {
  heroes: RawHero[];
}

interface RawItemsResponse {
  items: RawItem[];
}

async function fetchInitialDeadlockData(): Promise<DeadlockInitialData> {
  const responses = await Promise.all(INITIAL_ENDPOINTS.map((endpoint) => fetchDeadlockData(endpoint)));
  return INITIAL_ENDPOINTS.reduce(
    (data, endpoint, index) => ({ ...data, [endpoint]: responses[index] }),
    {} as DeadlockInitialData,
  );
}

async function fetchDeadlockData<T = JsonRecord>(type: DeadlockDataType): Promise<T> {
  const res = await fetch(`${DEADLOCK_API_BASE}/${type}.json`);
  if (!res.ok) {
    throw new Error(`${type}のデータ取得に失敗しました。`);
  }
  return res.json() as Promise<T>;
}

const emptyStats = (): StatBlock => ({
  health: 0,
  weaponDamage: 0,
  fireRate: 0,
  spiritPower: 0,
  moveSpeed: 0,
  stamina: 0,
  cooldownReduction: 0,
});

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const localized = (value: RawLocalizedText | string | null | undefined, fallback: string): LocalizedText => {
  if (typeof value === 'string') return { en: value, ja: value };
  return {
    en: value?.english ?? value?.byLanguage?.english ?? fallback,
    ja: value?.byLanguage?.japanese ?? value?.english ?? fallback,
  };
};

const normalizeAssetUrl = (asset: RawAsset | string | undefined) => {
  const assetPath = typeof asset === 'string' ? asset : asset?.publicPath ?? asset?.path ?? asset?.url;
  if (!assetPath) return undefined;
  return assetPath.startsWith('http') ? assetPath : `${DEADLOCK_ASSET_BASE}${assetPath}`;
};

const assetUrl = (assets: RawHero['assets'] | RawItem['assets'], preferred: string[]) => {
  const asset = preferred.map((key) => assets?.[key]).find((candidate) => normalizeAssetUrl(candidate));
  return normalizeAssetUrl(asset);
};

const mapStats = (properties?: RawItem['properties'] | JsonRecord | null): Partial<StatBlock> => {
  const stats = emptyStats();
  const get = (key: string) => parseNumber((properties?.[key] as { value?: unknown } | undefined)?.value ?? properties?.[key]);

  stats.health = get('MaxHealth') || get('BonusHealth') || get('EMaxHealth');
  stats.weaponDamage = get('WeaponPower') || get('BulletDamage') || get('EBulletDamage');
  stats.fireRate = get('FireRate') || get('TechFireRate') || get('ERoundsPerSecond');
  stats.spiritPower = get('TechPower') || get('ETechPower');
  stats.moveSpeed = get('MoveSpeed') || get('BonusMoveSpeed') || get('EMaxMoveSpeed');
  stats.stamina = get('Stamina') || get('EStamina');
  stats.cooldownReduction = get('CooldownReduction') || get('TechCooldownReduction') || get('EItemCooldown');

  return stats;
};

function formatHeroData(rawData: RawHeroesResponse): Hero[] {
  return rawData.heroes.map((hero) => ({
    id: String(hero.id ?? hero.slug ?? hero.heroId ?? hero.codeName),
    slug: hero.slug,
    name: localized(hero.displayName ?? hero.name, String(hero.id ?? hero.slug ?? hero.heroId)),
    role: localized(hero.playstyle ?? hero.description, ''),
    icon: assetUrl(hero.assets, ['icon', 'minimapIcon', 'card', 'portrait', 'selectionImage']) ?? '🧙',
    baseStats: { ...emptyStats(), ...mapStats(hero.baseStats ?? hero.stats), ...mapStats(hero.weaponStats) },
    growthPerLevel: { ...emptyStats(), ...mapStats(hero.growthPerLevel ?? hero.scalingStats) },
    abilities: hero.abilities,
    tags: hero.tags,
    assets: hero.assets,
  }));
}

function formatItemData(rawData: RawItemsResponse, abilitiesData: JsonRecord): Item[] {
  return rawData.items
    .filter((item) => item.kind === 'upgrade' && item.shop?.isPublicShopItem !== false)
    .map((item) => ({
      id: item.id ?? item.slug ?? crypto.randomUUID(),
      slug: item.slug,
      name: localized(item.displayName ?? item.name, item.id ?? 'Unknown item'),
      category: {
        en: item.shop?.tierLabel ? `${item.shop.category ?? 'Item'} · ${item.shop.tierLabel}` : item.shop?.category ?? 'Item',
        ja: item.shop?.tierLabel ? `${item.shop.category ?? 'アイテム'} · ${item.shop.tierLabel}` : item.shop?.category ?? 'アイテム',
      },
      price: parseNumber(item.shop?.cost),
      icon: assetUrl(item.assets, ['icon', 'shopIcon', 'card', 'image']) ?? '📦',
      stats: mapStats(item.properties),
      rawProperties: item.properties,
      ability: item.ability,
      abilities: item.abilities,
      tooltip: item.tooltip,
      assets: item.assets,
      effects: item.activation?.isActive
        ? [
            {
              id: `${item.id ?? item.slug}-active`,
              name: { en: 'Active effect', ja: 'アクティブ効果' },
              description: localized(item.description ?? resolveAbilityDescription(item, abilitiesData), ''),
              stats: {},
              conditional: true,
              defaultEnabled: false,
            },
          ]
        : [],
    }));
}

function collectAssets(entries: Array<{ id?: string | number; slug?: string; assets?: Record<string, RawAsset | string | undefined> | null }>) {
  return entries.map((entry) => ({
    id: String(entry.id ?? entry.slug),
    assets: entry.assets,
  }));
}

function getArrayFromResponse<T = JsonRecord>(response: JsonRecord, key: string): T[] {
  const value = response[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function resolveAbilityDescription(item: RawItem, abilitiesData: JsonRecord) {
  const abilitySlug = typeof item.ability === 'string' ? item.ability : item.slug;
  const abilities = getArrayFromResponse<JsonRecord>(abilitiesData, 'abilities');
  const matched = abilities.find((ability) => ability.slug === abilitySlug || ability.id === abilitySlug);
  const description = matched?.description ?? matched?.tooltip;
  return typeof description === 'string' || typeof description === 'object' ? (description as RawLocalizedText | string) : undefined;
}

app.listen(port, () => {
  console.log(`Deadlock build simulator API listening on http://localhost:${port}`);
});
