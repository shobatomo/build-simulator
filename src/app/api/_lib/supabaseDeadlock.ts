import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AssetIcons, Hero, Item } from '../../../types';
import {
  DEADLOCK_API_BASE,
  formatDeadlockData,
  loadDeadlockRawAssets,
  selectAssetIcons,
  type JsonRecord,
  type RawHero,
  type RawItem,
} from './deadlockData';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DeadlockDataResponse = {
  heroes: Hero[];
  items: Item[];
  assets: {
    icons: AssetIcons;
    source: string;
  };
  metadata: {
    source: string;
    endpoints: string[];
  };
};

type RawPair<T> = {
  english: T;
  japanese?: T;
};

type SupabaseSyncRun = {
  id: string;
};

const toJson = (value: unknown): JsonValue => value as JsonValue;

const requireServerEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Supabase access.`);
  return value;
};

let serverClient: SupabaseClient | undefined;

export const getSupabaseServerClient = () => {
  serverClient ??= createClient(
    requireServerEnv('SUPABASE_URL'),
    requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  return serverClient;
};

const indexById = <T extends { id: number }>(values: T[]) => new Map(values.map((value) => [value.id, value]));

const pickRawPairs = <T extends { id: number }>(englishValues: T[], japaneseValues: T[]): Array<RawPair<T>> => {
  const japaneseById = indexById(japaneseValues);
  return englishValues.map((english) => ({ english, japanese: japaneseById.get(english.id) }));
};

const firstHeroId = (item: RawItem) => {
  if (typeof item.hero === 'number') return item.hero;
  const [heroId] = item.heroes ?? [];
  return typeof heroId === 'number' ? heroId : null;
};

const upsertHeroes = async (
  supabase: SupabaseClient,
  pairs: Array<RawPair<RawHero>>,
  formattedHeroes: Hero[],
  syncRunId: string,
) => {
  const formattedById = new Map(formattedHeroes.map((hero) => [Number(hero.id), hero]));
  const rows = pairs.map(({ english, japanese }) => {
    const formatted = formattedById.get(english.id);
    return {
      external_id: english.id,
      class_name: english.class_name,
      name_en: english.name,
      name_ja: japanese?.name ?? english.name,
      role_en: english.description?.role ?? english.description?.playstyle ?? null,
      role_ja: japanese?.description?.role ?? japanese?.description?.playstyle ?? null,
      icon_url: formatted?.icon ?? null,
      formatted_json: toJson(formatted),
      raw_json: toJson({ english, japanese }),
      synced_at: new Date().toISOString(),
      sync_run_id: syncRunId,
    };
  });

  if (rows.length === 0) return;
  const { error } = await supabase.from('deadlock_heroes').upsert(rows, { onConflict: 'external_id' });
  if (error) throw error;
};

const upsertItemsAndAbilities = async (
  supabase: SupabaseClient,
  pairs: Array<RawPair<RawItem>>,
  formattedItems: Item[],
  syncRunId: string,
) => {
  const formattedById = new Map(formattedItems.map((item) => [Number(item.id), item]));
  const itemRows = [];
  const abilityRows = [];

  for (const { english, japanese } of pairs) {
    if (english.type === 'ability') {
      abilityRows.push({
        external_id: english.id,
        class_name: english.class_name,
        name_en: english.name,
        name_ja: japanese?.name ?? english.name,
        hero_external_id: firstHeroId(english),
        ability_type: typeof english.ability_type === 'string' ? english.ability_type : null,
        image_url: english.image_webp ?? english.image ?? null,
        raw_json: toJson({ english, japanese }),
        synced_at: new Date().toISOString(),
        sync_run_id: syncRunId,
      });
      continue;
    }

    const formatted = formattedById.get(english.id);
    itemRows.push({
      external_id: english.id,
      class_name: english.class_name,
      name_en: english.name,
      name_ja: japanese?.name ?? english.name,
      item_type: english.type,
      slot_type: english.item_slot_type ?? null,
      tier: english.item_tier ?? null,
      price: english.cost ?? null,
      shopable: english.shopable ?? null,
      hero_external_id: firstHeroId(english),
      formatted_json: toJson(formatted ?? null),
      raw_json: toJson({ english, japanese }),
      synced_at: new Date().toISOString(),
      sync_run_id: syncRunId,
    });
  }

  if (itemRows.length > 0) {
    const { error } = await supabase.from('deadlock_items').upsert(itemRows, { onConflict: 'external_id' });
    if (error) throw error;
  }

  if (abilityRows.length > 0) {
    const { error } = await supabase.from('deadlock_abilities').upsert(abilityRows, { onConflict: 'external_id' });
    if (error) throw error;
  }
};

const upsertAssetDocuments = async (supabase: SupabaseClient, icons: JsonRecord, syncRunId: string) => {
  const { error } = await supabase.from('deadlock_asset_documents').upsert(
    {
      asset_key: 'icons',
      source_url: `${DEADLOCK_API_BASE}/icons`,
      raw_json: toJson(icons),
      synced_at: new Date().toISOString(),
      sync_run_id: syncRunId,
    },
    { onConflict: 'asset_key' },
  );
  if (error) throw error;
};

export const syncDeadlockDataToSupabase = async (): Promise<DeadlockDataResponse> => {
  const supabase = getSupabaseServerClient();
  const startedAt = new Date().toISOString();
  const { data: syncRun, error: syncRunError } = await supabase
    .from('deadlock_sync_runs')
    .insert({ source: DEADLOCK_API_BASE, endpoints: ['heroes', 'items', 'icons'], status: 'started', started_at: startedAt })
    .select('id')
    .single<SupabaseSyncRun>();

  if (syncRunError) throw syncRunError;

  try {
    const rawAssets = await loadDeadlockRawAssets();
    const formatted = formatDeadlockData(rawAssets);

    await upsertHeroes(
      supabase,
      pickRawPairs(rawAssets.englishHeroes, rawAssets.japaneseHeroes),
      formatted.heroes,
      syncRun.id,
    );
    await upsertItemsAndAbilities(
      supabase,
      pickRawPairs(rawAssets.englishItems, rawAssets.japaneseItems),
      formatted.items,
      syncRun.id,
    );
    await upsertAssetDocuments(supabase, rawAssets.icons, syncRun.id);

    const { error: finishError } = await supabase
      .from('deadlock_sync_runs')
      .update({ status: 'success', finished_at: new Date().toISOString() })
      .eq('id', syncRun.id);
    if (finishError) throw finishError;

    return formatted;
  } catch (error) {
    await supabase
      .from('deadlock_sync_runs')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
        finished_at: new Date().toISOString(),
      })
      .eq('id', syncRun.id);
    throw error;
  }
};

export const loadDeadlockDataFromSupabase = async (): Promise<DeadlockDataResponse> => {
  const supabase = getSupabaseServerClient();
  const [heroesResult, itemsResult, iconsResult] = await Promise.all([
    supabase.from('deadlock_heroes').select('formatted_json').order('external_id', { ascending: true }),
    supabase
      .from('deadlock_items')
      .select('formatted_json')
      .not('formatted_json', 'is', null)
      .order('external_id', { ascending: true }),
    supabase.from('deadlock_asset_documents').select('raw_json, source_url').eq('asset_key', 'icons').maybeSingle(),
  ]);

  if (heroesResult.error) throw heroesResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (iconsResult.error) throw iconsResult.error;

  const heroes = heroesResult.data.map((row) => row.formatted_json as Hero);
  const items = itemsResult.data.map((row) => row.formatted_json as Item);
  const icons = (iconsResult.data?.raw_json ?? {}) as JsonRecord;

  return {
    heroes,
    items,
    assets: {
      icons: selectAssetIcons(icons),
      source: iconsResult.data?.source_url ?? `${DEADLOCK_API_BASE}/icons`,
    },
    metadata: {
      source: DEADLOCK_API_BASE,
      endpoints: ['heroes', 'items', 'icons'],
    },
  };
};

export const loadSupabaseHeroes = async () => {
  const data = await loadDeadlockDataFromSupabase();
  return { data: data.heroes, source: data.metadata.source };
};

export const loadSupabaseItems = async () => {
  const data = await loadDeadlockDataFromSupabase();
  return { data: data.items, source: data.metadata.source };
};
