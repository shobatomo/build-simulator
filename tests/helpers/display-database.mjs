import { loadTs } from './load-ts.mjs';
const { prepareDisplayProjection } = loadTs('server/displayProjection.ts');
export const publishDisplay = async (db, bundle, revision, projection) => (await db.query(
  'select deadlock_admin.publish_display_asset_release($1::jsonb,$2::jsonb,$3::bigint,$4::jsonb) as data',
  [bundle.snapshot, bundle.catalog, revision, projection ?? await prepareDisplayProjection(bundle)],
)).rows[0].data;
export const readDisplay = async (db, collection = 'all') => (await db.query(
  'select public.read_deadlock_display_release($1::text,$2::text) as data', [collection, 'legacy-display-v1'],
)).rows[0].data;
