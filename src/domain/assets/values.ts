import type { JsonObject, JsonValue, ParsedValue } from './types';

export const objectValue = (value: JsonValue | undefined): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;

export const textValue = (value: JsonValue | undefined): string | null =>
  typeof value === 'string' ? value : null;

// Whole-string matching prevents ranges, rank lists and expressions becoming scalars.
// Units are retained, never converted or used to infer a stacking operation here.
const scalarPattern = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(%|ms|s|m\/s|m|souls)?$/i;

export function parseAssetValue(raw: JsonValue | undefined): ParsedValue {
  if (raw === undefined || raw === null) return { status: 'unknown', raw: null, reason: 'missing' };
  if (typeof raw === 'number') {
    return Number.isFinite(raw)
      ? { status: 'known', raw, value: raw, unit: null }
      : { status: 'unknown', raw, reason: 'non-finite-number' };
  }
  if (typeof raw !== 'string') return { status: 'unknown', raw, reason: 'non-scalar-value' };
  const match = raw.trim().match(scalarPattern);
  if (!match) return { status: 'unknown', raw, reason: 'unsupported-scalar-format' };
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return { status: 'unknown', raw, reason: 'non-finite-number' };
  return { status: 'known', raw, value, unit: match[2]?.toLowerCase() ?? null };
}
