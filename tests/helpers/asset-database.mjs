import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// No disk path, network URL, environment variables or real database credentials.
export async function assetDatabase({ recovery = false } = {}) {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
    await db.exec(readFileSync(new URL('../../docs/migrations/versioned-assets-proposal.sql', import.meta.url), 'utf8'));
    if (recovery) await db.exec(readFileSync(new URL('../../docs/migrations/asset-recovery-proposal.sql', import.meta.url), 'utf8'));
    return db;
  } catch (error) { await db.close(); throw error; }
}
export const publish = async (db, bundle, revision) => (await db.query(
  'select public.publish_deadlock_asset_release($1::jsonb,$2::jsonb,$3::bigint) as data',
  [bundle.snapshot, bundle.catalog, revision],
)).rows[0].data;
export const readActive = async db => (await db.query('select public.read_deadlock_asset_release() as data')).rows[0].data;
export const restore = async (db, parameters) => (await db.query(
  'select deadlock_admin.restore_asset_release($1::uuid,$2::bigint,$3::jsonb,$4::jsonb,$5::text) as data',
  [parameters.p_operation_id, parameters.p_expected_revision, parameters.p_snapshot, parameters.p_catalog, parameters.p_reason],
)).rows[0].data;
