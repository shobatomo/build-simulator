import type { AssetIcons } from '../types';
import { formatHeroData, formatItemData, type RawHero, type RawItem } from '../app/api/_lib/deadlockData';
import { verifyAssetBundle, type AssetRepository } from './versionedAssetStore';
import type { AssetLocale } from '../domain/assets/types';

type DisplayHero = RawHero & { player_selectable?: boolean; disabled?: boolean; in_development?: boolean; development_state?: string };
type DisplayItem = RawItem & { disabled?: boolean };

// Compatibility projection only: the existing UI's numeric formatter is NOT
// the verified combat model. Persisted raw/normalized data remain untouched.
export async function loadVersionedDisplayData(repository: Pick<AssetRepository, 'readActive'>) {
  const active = await repository.readActive();
  if (!active) throw new Error('NO_ACTIVE_ASSET_RELEASE');
  if (!Number.isSafeInteger(active.revision) || active.revision < 1) throw new Error('INVALID_REVISION');
  verifyAssetBundle(active);
  const collection = <T>(endpoint: 'heroes' | 'items', locale: AssetLocale): T[] =>
    active.snapshot.documents.find(document => document.endpoint === endpoint && document.locale === locale)!.payload as unknown as T[];
  const englishHeroes = collection<DisplayHero>('heroes', 'english');
  const japaneseHeroes = collection<RawHero>('heroes', 'japanese');
  const englishItems = collection<DisplayItem>('items', 'english');
  const japaneseItems = collection<RawItem>('items', 'japanese');
  // An explicit, conservative display policy, not an inference of upstream's
  // only_active filter. Unknown visibility flags do not imply visibility.
  const visibleHeroes = englishHeroes.filter(hero => hero.player_selectable === true &&
    hero.disabled === false && hero.in_development === false && hero.development_state === 'release');
  // Upgrade.disabled is optional and absent from the captured 6819 upgrades.
  // Explicit shopable=true (in the formatter) is the positive availability
  // signal; an explicit disabled flag still overrides it. Null/invalid flags
  // are not accepted as false.
  const visibleItems = new Set(englishItems.filter(item => (item.disabled === undefined || item.disabled === false) &&
    ['weapon', 'vitality', 'spirit'].includes(item.item_slot_type ?? '')).map(item => String(item.id)));
  const heroes = formatHeroData(visibleHeroes, japaneseHeroes, englishItems, japaneseItems);
  // Resolve component chains against the FULL catalog before hiding entries.
  const items = formatItemData(englishItems, japaneseItems).filter(item => visibleItems.has(item.id));
  if (!heroes.length || !items.length) throw new Error('EMPTY_DISPLAY_COLLECTION');
  const source = active.snapshot.sourceBaseUrl;
  // The versioned snapshot has no /icons document. Never mix an unpinned read
  // into this response. Existing UI supports absent optional decorative icons.
  const icons: AssetIcons = { categories: {}, stats: {} };
  return {
    heroes, items, assets: { icons, source },
    metadata: {
      source, endpoints: ['heroes', 'items'], storage: 'versioned' as const,
      clientVersion: active.snapshot.clientVersion,
      normalizerVersion: active.catalog.normalizerVersion,
      snapshotHash: active.snapshot.contentHash, revision: active.revision,
      displayModel: 'legacy-unverified' as const,
      visibilityPolicy: 'selectable-release-v1' as const,
      omitted: { heroes: englishHeroes.length - heroes.length, items: englishItems.length - items.length },
      warnings: ['LEGACY_DISPLAY_NUMERIC_COERCION', 'DECORATIVE_ICONS_NOT_SNAPSHOTTED'],
    },
  };
}
