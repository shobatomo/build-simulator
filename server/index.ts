import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { heroes, items } from './mockApiData.js';
import type { Hero, Item, LocalizedText, StatBlock } from '../src/types.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const DEADLOCK_API_BASE = 'https://deadlock.io/api/v1';
const DEADLOCK_ASSET_BASE = 'https://deadlock.io';

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
    const [heroesData, itemsData] = await Promise.all([
      fetchDeadlockData<RawHeroesResponse>('heroes'),
      fetchDeadlockData<RawItemsResponse>('items'),
    ]);

    response.json({
      heroes: formatHeroData(heroesData),
      items: formatItemData(itemsData),
      assets: {
        baseUrl: DEADLOCK_ASSET_BASE,
        heroes: collectAssets(heroesData.heroes),
        items: collectAssets(itemsData.items),
      },
    });
  } catch (error) {
    console.error(`データ取得中にエラーが発生しました。: ${error}`);
    response.status(500).json({
      error: `データの取得に失敗しました。${error}`,
    });
  }
});

type DeadlockDataType = 'items' | 'heroes';

type JsonRecord = Record<string, unknown>;

interface RawLocalizedText {
  english?: string | null;
  byLanguage?: {
    english?: string | null;
    japanese?: string | null;
  } | null;
}

interface RawAsset {
  publicPath?: string | null;
  type?: string | null;
}

interface RawHero {
  id?: string | number;
  slug?: string;
  heroId?: string | number;
  codeName?: string;
  displayName?: RawLocalizedText | null;
  playstyle?: RawLocalizedText | null;
  stats?: JsonRecord | null;
  assets?: Record<string, RawAsset | undefined> | null;
}

interface RawItem {
  id?: string;
  slug?: string;
  displayName?: RawLocalizedText | null;
  description?: RawLocalizedText | null;
  kind?: string;
  shop?: {
    category?: string | null;
    tierLabel?: string | null;
    cost?: number | string | null;
    isPublicShopItem?: boolean;
  } | null;
  properties?: Record<string, { value?: string | number | null } | undefined> | null;
  activation?: { isActive?: boolean; isPassive?: boolean } | null;
  assets?: Record<string, RawAsset | undefined> | null;
}

interface RawHeroesResponse {
  heroes: RawHero[];
}

interface RawItemsResponse {
  items: RawItem[];
}

async function fetchDeadlockData<T>(type: DeadlockDataType): Promise<T> {
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

const localized = (value: RawLocalizedText | null | undefined, fallback: string): LocalizedText => ({
  en: value?.english ?? value?.byLanguage?.english ?? fallback,
  ja: value?.byLanguage?.japanese ?? value?.english ?? fallback,
});

const assetUrl = (assets: RawHero['assets'] | RawItem['assets'], preferred: string[]) => {
  const asset = preferred.map((key) => assets?.[key]).find((candidate) => candidate?.publicPath);
  return asset?.publicPath ? `${DEADLOCK_ASSET_BASE}${asset.publicPath}` : undefined;
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
    name: localized(hero.displayName, String(hero.id ?? hero.slug ?? hero.heroId)),
    role: localized(hero.playstyle, ''),
    icon: assetUrl(hero.assets, ['icon', 'card', 'portrait']) ?? '🧙',
    baseStats: { ...emptyStats(), ...mapStats(hero.stats) },
    growthPerLevel: emptyStats(),
  }));
}

function formatItemData(rawData: RawItemsResponse): Item[] {
  return rawData.items
    .filter((item) => item.kind === 'upgrade' && item.shop?.isPublicShopItem !== false)
    .map((item) => ({
      id: item.id ?? item.slug ?? crypto.randomUUID(),
      name: localized(item.displayName, item.id ?? 'Unknown item'),
      category: {
        en: item.shop?.tierLabel ? `${item.shop.category ?? 'Item'} · ${item.shop.tierLabel}` : item.shop?.category ?? 'Item',
        ja: item.shop?.tierLabel ? `${item.shop.category ?? 'アイテム'} · ${item.shop.tierLabel}` : item.shop?.category ?? 'アイテム',
      },
      price: parseNumber(item.shop?.cost),
      icon: assetUrl(item.assets, ['icon', 'shopIcon']) ?? '📦',
      stats: mapStats(item.properties),
      effects: item.activation?.isActive
        ? [
            {
              id: `${item.id ?? item.slug}-active`,
              name: { en: 'Active effect', ja: 'アクティブ効果' },
              description: localized(item.description, ''),
              stats: {},
              conditional: true,
              defaultEnabled: false,
            },
          ]
        : [],
    }));
}

function collectAssets(entries: Array<{ id?: string | number; slug?: string; assets?: Record<string, RawAsset | undefined> | null }>) {
  return entries.map((entry) => ({
    id: String(entry.id ?? entry.slug),
    assets: entry.assets,
  }));
}

app.listen(port, () => {
  console.log(`Deadlock build simulator API listening on http://localhost:${port}`);
});
