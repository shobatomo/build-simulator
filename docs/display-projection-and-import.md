# Small display reads and owner-only import preparation

2026-10-26. Local work based on published `a5ca31b`; not deployed, applied to
Supabase, or enabled. No UI files changed. This document supersedes the older
full-bundle screen read and application write grants. Original uncommitted work
remains separate.

## Read path and integrity

The old screen read transferred raw + normalized JSON (~48.93 MB) and verified
and normalized it again on each request. `prepareDisplayProjection` now performs
the FULL snapshot and normalization-equivalence checks at the trusted owner
publication boundary, then derives the existing display model. Raw/catalog remain
complete and available to owners for audit, recovery and future calculations.

Three immutable sections (heroes, items, common metadata) each bind source hash,
client version, normalizer version, projection version and section identity to
the display value. SHA-256 covers exact UTF-8 text. SQL independently checks this
hash using built-in sha256 and binds provenance with constraints/foreign keys.
SQL does NOT reproduce the TypeScript formatter. Only verified owner preparation
is authorized to publish: a submitted `verified=true` flag would not be evidence.
This is integrity checking, not a signature against a malicious database owner.

`read_deadlock_display_release` is one STABLE SQL statement/MVCC snapshot joining
the pointer and requested sections. It never selects snapshot_json or
normalized_json. The application verifies returned section hashes, identities,
versions and completeness before returning the existing screen contract. It does
not re-normalize full assets. Missing/corrupt/mixed data fails closed with 503;
there are no write calls, caches, upstream fetches or silent fallbacks.

All-data GET obtains both collections from one release. Separate hero/item calls
include revision/hash for caller comparison. A section is stored once, not again
in an all-data copy. Responses are bounded to 4,000,000 UTF-8 bytes. Display remains
`legacy-unverified`; this is not a claim of accurate game formulas. No matchup UI.

Bump `legacy-display-v1` whenever formatter/visibility semantics change. Different
text under the same version is rejected. Future version support/backfill requires
explicit migration review; current SQL deliberately supports only v1.

## SQL and application privileges

These are unregistered proposals, NOT migrations applied to any real database.
After approval, register/review using the supported migration tool in this order:

1. versioned-assets-proposal.sql (revised owner-only raw/catalog access).
2. asset-recovery-proposal.sql (existing owner-only recovery).
3. display-projection-proposal.sql (new section table/read/publication safeguards).

Existing five game tables and their ACLs/default privileges are untouched. The
third proposal adds public.deadlock_display_projections with a composite PK,
public.read_deadlock_display_release(text,text), private
deadlock_admin.publish_display_asset_release(jsonb,jsonb,bigint,jsonb), private
require_active_display_projection(), and two deferred constraint triggers.
Together with earlier proposals: four new public tables and one private recovery
table. No sequence, extension, role, login, credential, or exposed schema is added.

All new tables have RLS, with no anon/authenticated policies. Creation and explicit
REVOKE ALL from PUBLIC/anon/authenticated/service_role occur in the SAME transaction
to remove automatic default grants. The only application permissions are:

| Object | service_role |
| --- | --- |
| deadlock_active_asset_release | SELECT |
| deadlock_asset_snapshots | SELECT(id, client_version, content_hash) only |
| deadlock_display_projections | SELECT |
| read_deadlock_display_release(text,text) | EXECUTE |

No raw/catalog JSON or full-bundle RPC access, writes, publish/recovery or private
schema access. All functions are SECURITY INVOKER, search_path empty, relations
schema-qualified. Do not expose deadlock_admin in PostgREST. Existing service_role
still has existing-object privileges: this is not a dedicated read-only credential.

Owner publication retains the existing transaction advisory lock/CAS, full
raw/catalog append and pointer update, adds the verified sections in the SAME
transaction, then returns only a small receipt. Deferred constraints prevent
committing a pointer without all three sections, including recovery/direct use of
the older publisher. Deleting active sections also fails. Failed changes preserve
the prior release/history. PGlite tests validate CAS, not OS multi-session races.

## Initial import: available means and remaining gap

The existing Supabase SQL connector was observed as current_user=postgres. Its
interface accepts SQL text, not a local file/stream. The exposed tool contract
does not document its request-size ceiling. No large external request was tried.
It forbids server-side file/OS reads; a SQL filename cannot read a file on this PC.
Vercel's existing server credential is service_role, not an owner import credential
under these ACLs. Direct owner PostgreSQL access from this PC is not established.
No secret has been read/generated/changed and no new credential is assumed.

Do not send ~49 MB through a public Vercel upload or blindly call a giant RPC.
assetImportPlan.ts is OFFLINE only: full verification, 192 KiB byte chunks with
per-chunk SHA-256, whole-content digest and version provenance. Base64 preserves
UTF-8 boundaries. A JSON chunk is about 263 KB; this is a planning bound, not a
measured connector guarantee. No uploader, staging schema or network call exists.

Recommended eventual workflow, pending a concrete authorized transport:

1. Pin approved public 6819 / normalizer 0.2.0 data; verify all five documents,
   catalog equivalence and deterministic display projection offline.
2. Confirm a bounded owner-side client upload. If unavailable, stop for a specific
   connection decision; do not grant application writes as a workaround.
3. If chunk staging is needed, separately propose owner-only
   deadlock_admin.asset_import_sessions/asset_import_chunks and bounded append /
   finalize operations (NOT implemented/applied here). Require import identity,
   ordered index, byte count and hash; identical retry is idempotent, conflicting
   retry rejected. Incomplete staged data must never become active.
4. Finalize in one owner transaction: publication lock + expected revision check,
   every chunk/count/digest check, exact reconstruction, then raw/catalog/sections
   plus pointer and receipt. Return only receipt. Do not trust a client flag.
5. After uncertain completion, read receipt/pointer/hash before retry. Keep old
   snapshots and inactive partial imports; do not automatically delete anything.

Transport capacity, staging SQL/grants, PG17 assembly resource use, resume/finalize
protocol and receipt reconciliation are still unimplemented/unverified. They need
review before requesting real import approval. The existing single-request private
publisher is useful for small/local tests, not evidence of production-size ingress.

## Measurement and activation gates

Full public capture dated 2026-10-23: client 6819, normalizer 0.2.0, snapshot hash
05dcbaf383cf31234de973db89cfa04cb6986943fb6e0ffa407f4b911b756e07.
65 raw heroes / 781 raw items, unchanged display of 42 heroes / 173 items.

| Request | Previous internal bytes | New internal bytes | New public bytes |
| --- | ---: | ---: | ---: |
| all | 48,934,202 | 2,903,192 | 2,457,446 |
| heroes | 48,934,202 | 2,306,683 | 1,925,649 |
| items | 48,934,202 | 597,647 | 532,293 |

All-data internal transfer reduced 94.07%. Display deep-equality passes except
added projectionVersion metadata. One sample per isolated Node process (file
parse + old/new validation, no network): 4455.6 ms -> 26.1 ms; RSS increase
701,681,664 -> 14,614,528 bytes. These are local samples, NOT peak memory,
production performance or latency guarantees.

Full-capture PGlite validation additionally saved all 65 heroes / 781 items / five
raw documents, read the same small section responses under service_role, and
denied direct raw JSON reads. Publication receipt: 185 bytes. The verified offline
bundle+projection import plan is 51,837,262 bytes in 264 chunks (196,608 data bytes
per full chunk; maximum serialized chunk 262,260 bytes). Reconstruction succeeds;
zero chunks were sent externally. Unit fixtures also reject missing, reordered,
duplicated, changed and mismatched chunks. Supabase-like permissive default grants
are simulated in PGlite to test the explicit revocations.

Required before activation: revised SQL/ACL checks on approved PG17; PostgREST
schema-cache/effective permissions; full-size read performance; actual owner import
and rollback; staged API/UI smoke. PG16 was NOT restarted: old PG16 results cover
the older code/profile only. Production remains a5ca31b with versioned mode off.
Deploy the new reader with mode OFF before considering versioned: a5ca31b's old
reader cannot use these restricted grants. No publication is authorized this turn.

Rollback: legacy/unset read mode + suitable deployment, retaining old tables and
all snapshots. Owner data recovery requires current revision and exact saved target,
restores the matching sections, and increments revision. Never reset revision or
delete history.

References: [grants/RLS](https://supabase.com/docs/guides/api/securing-your-api),
[function security](https://supabase.com/docs/guides/database/functions),
[Vercel payload limit](https://vercel.com/docs/functions/limitations).
