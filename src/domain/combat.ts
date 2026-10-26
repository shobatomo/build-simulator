export interface BuildSelection {
  clientVersion: number;
  normalizerVersion: string;
  sourceSnapshotHash: string;
  heroId: string;
  level: number;
  itemIds: string[];
  abilityStages: Record<string, number>;
}

export type DamageType = 'bullet' | 'spirit';

export interface AttackInput {
  build: BuildSelection;
  kind: 'weapon-shot' | 'ability-hit';
  abilityId?: string;
  damageType: DamageType;
  // Explicit damage at impact, before resistance/shield. Build effects, scaling,
  // headshots and distance falloff must already be reflected by the caller.
  rawDamageAtImpact: number | null;
}

export interface DefenseInput {
  build: BuildSelection;
  health: number | null;
  applicableShield: number | null;
  // Caller-supplied final resistance; this module does not stack item resistances.
  effectiveResistancePercent: Record<DamageType, number | null>;
}

export interface CombatConditions {
  model: 'resolved-single-hit-v1';
  distanceMeters: number | null;
  hitLocation: 'body' | 'head';
  penetrationPercent: number | null;
  amplificationPercent: number | null;
  specialEffects: string[];
}

export interface ImpactEstimate {
  damageAfterResistance: number;
  shieldDamage: number;
  healthDamage: number;
  remainingShield: number;
  remainingHealth: number;
  overkill: number;
}

export interface CombatResult {
  status: 'assumption-based' | 'incomplete' | 'unsupported' | 'invalid';
  modelVersion: 'resolved-single-hit-v1';
  estimate: ImpactEstimate | null;
  reasons: string[];
  assumptions: string[];
}

const assumptions = [
  'This is an explicit-input approximation, not a verified simulation of the current game.',
  'Selected heroes, items and ability stages are provenance only; their effects are not automatically resolved.',
  'Raw damage at impact already includes all attacker build effects, ability scaling, headshots and distance falloff.',
  'The supplied resistance is final; no resistance stacking, penetration or amplification order is inferred.',
  'The supplied applicable shield absorbs post-resistance damage before health; bypasses and triggers are excluded.',
];

export function calculateSingleImpact(attacker: AttackInput, defender: DefenseInput, conditions: CombatConditions): CombatResult {
  const result = (status: CombatResult['status'], reasons: string[], estimate: ImpactEstimate | null = null): CombatResult => ({
    status, modelVersion: 'resolved-single-hit-v1', estimate, reasons, assumptions: [...assumptions],
  });
  for (const build of [attacker.build, defender.build]) {
    if (!Number.isSafeInteger(build.clientVersion) || build.clientVersion <= 0 || !build.normalizerVersion.trim() ||
      !/^[a-f0-9]{64}$/.test(build.sourceSnapshotHash) || !build.heroId.trim() || !Number.isSafeInteger(build.level) || build.level < 1) {
      return result('invalid', ['Build provenance and level must be explicit and valid.']);
    }
  }
  if (attacker.build.clientVersion !== defender.build.clientVersion || attacker.build.normalizerVersion !== defender.build.normalizerVersion || attacker.build.sourceSnapshotHash !== defender.build.sourceSnapshotHash) {
    return result('invalid', ['Attacker and defender must use the same raw snapshot, client and normalizer versions.']);
  }
  if (!['weapon-shot', 'ability-hit'].includes(attacker.kind) || !['bullet', 'spirit'].includes(attacker.damageType)) return result('unsupported', ['Unknown attack or damage type.']);
  if (conditions.model !== 'resolved-single-hit-v1') return result('unsupported', ['Unknown calculation model.']);
  const missing: string[] = [];
  const resistance = defender.effectiveResistancePercent[attacker.damageType];
  const values = {
    rawDamageAtImpact: attacker.rawDamageAtImpact,
    health: defender.health,
    applicableShield: defender.applicableShield,
    resistance,
    penetrationPercent: conditions.penetrationPercent,
    amplificationPercent: conditions.amplificationPercent,
    distanceMeters: conditions.distanceMeters,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value == null) missing.push(name);
    else if (!Number.isFinite(value)) return result('invalid', [`${name} must be finite.`]);
  }
  if (missing.length) return result('incomplete', missing.map((name) => `${name} is unknown; it was not replaced with zero.`));
  const raw = attacker.rawDamageAtImpact!;
  const health = defender.health!;
  const shield = defender.applicableShield!;
  if (raw < 0 || health < 0 || shield < 0 || conditions.distanceMeters! < 0 || resistance! > 100 || conditions.penetrationPercent! < 0 || conditions.amplificationPercent! < 0) {
    return result('invalid', ['Damage, health, shield, distance and modifiers must be non-negative; resistance must not exceed 100%.']);
  }
  if (conditions.penetrationPercent !== 0 || conditions.amplificationPercent !== 0 || conditions.specialEffects.length > 0) {
    return result('unsupported', ['Penetration, amplification and special effects require verified rules; no numeric estimate is produced.']);
  }
  if (conditions.hitLocation !== 'body') return result('unsupported', ['Headshot rules are not implemented.']);
  if (attacker.kind === 'ability-hit' && !attacker.abilityId) return result('incomplete', ['An ability ID is required for an ability hit.']);
  const damageAfterResistance = raw * (1 - resistance! / 100);
  if (!Number.isFinite(damageAfterResistance)) return result('invalid', ['Damage calculation overflow.']);
  const shieldDamage = Math.min(shield, damageAfterResistance);
  const damageToHealth = damageAfterResistance - shieldDamage;
  const healthDamage = Math.min(health, damageToHealth);
  return result('assumption-based', [], {
    damageAfterResistance, shieldDamage, healthDamage,
    remainingShield: shield - shieldDamage,
    remainingHealth: health - healthDamage,
    overkill: Math.max(0, damageToHealth - health),
  });
}
