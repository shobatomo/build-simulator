import type { AssetBundle } from './versionedAssetStore';
import { verifyAssetBundle } from './versionedAssetStore';

export interface AssetRecoveryRequest {
  // An operation ID is an idempotency identifier, never a credential.
  operationId: string;
  expectedRevision: number;
  target: AssetBundle;
  reason: string;
}

// Prepares reviewed parameters for the OWNER-ONLY recovery SQL proposal.
// No client, credentials, endpoint, database call or external fetch is created.
// The target must be the exact stored bundle, not a fresh API recapture.
export function prepareAssetRecovery(request: AssetRecoveryRequest) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(request.operationId)) throw new Error('INVALID_OPERATION_ID');
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 || request.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('INVALID_EXPECTED_REVISION');
  if (typeof request.reason !== 'string' || !request.reason.trim() || request.reason.trim().length > 500) throw new Error('INVALID_RECOVERY_REASON');
  const target: AssetBundle = JSON.parse(JSON.stringify(request.target));
  verifyAssetBundle(target);
  return {
    p_operation_id: request.operationId.toLowerCase(),
    p_expected_revision: request.expectedRevision,
    p_snapshot: target.snapshot,
    p_catalog: target.catalog,
    p_reason: request.reason.trim(),
  };
}
