import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs, plain } from './helpers/load-ts.mjs';

const { calculateSingleImpact } = loadTs('domain/combat.ts');
const build = (heroId) => ({ clientVersion: 6807, normalizerVersion: '0.1.0', sourceSnapshotHash: 'a'.repeat(64), heroId, level: 1, itemIds: [], abilityStages: {} });
const scenario = () => ({
  attacker: { build: build('1'), kind: 'weapon-shot', damageType: 'bullet', rawDamageAtImpact: 200 },
  defender: { build: build('2'), health: 100, applicableShield: 50, effectiveResistancePercent: { bullet: 25, spirit: 10 } },
  conditions: { model: 'resolved-single-hit-v1', distanceMeters: 10, hitLocation: 'body', penetrationPercent: 0, amplificationPercent: 0, specialEffects: [] },
});

test('single-hit model separates attacker, defender and conditions, and labels all estimates as assumptions', () => {
  const input = scenario();
  const before = JSON.stringify(input);
  const result = calculateSingleImpact(input.attacker, input.defender, input.conditions);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.status, 'assumption-based');
  assert.ok(result.assumptions.some((value) => value.includes('not a verified simulation')));
  assert.ok(result.assumptions.some((value) => value.includes('not automatically resolved')));
  assert.deepEqual(plain(result.estimate), { damageAfterResistance: 150, shieldDamage: 50, healthDamage: 100, remainingShield: 0, remainingHealth: 0, overkill: 0 });
});

test('ability hit uses explicit spirit damage and records overkill without inventing scaling rules', () => {
  const { attacker, defender, conditions } = scenario();
  Object.assign(attacker, { kind: 'ability-hit', abilityId: '30', damageType: 'spirit' });
  const result = calculateSingleImpact(attacker, defender, conditions);
  assert.equal(result.status, 'assumption-based');
  assert.equal(result.estimate.damageAfterResistance, 180);
  assert.equal(result.estimate.overkill, 30);
});

test('shield-only absorption and 100% effective resistance are deterministic boundaries', () => {
  const { attacker, defender, conditions } = scenario();
  defender.applicableShield = 200;
  assert.equal(calculateSingleImpact(attacker, defender, conditions).estimate.healthDamage, 0);
  defender.effectiveResistancePercent.bullet = 100;
  assert.equal(calculateSingleImpact(attacker, defender, conditions).estimate.damageAfterResistance, 0);
});

test('explicit negative final resistance is handled as an assumption, not a derived game cap', () => {
  const { attacker, defender, conditions } = scenario();
  defender.effectiveResistancePercent.bullet = -25;
  assert.equal(calculateSingleImpact(attacker, defender, conditions).estimate.damageAfterResistance, 250);
});

for (const field of ['health', 'applicableShield']) {
  test(`unknown ${field} produces no estimate`, () => {
    const { attacker, defender, conditions } = scenario();
    defender[field] = null;
    const result = calculateSingleImpact(attacker, defender, conditions);
    assert.equal(result.status, 'incomplete');
    assert.equal(result.estimate, null);
  });
}

test('unknown damage, resistance or modifiers are not treated as zero', () => {
  for (const target of ['damage', 'resistance', 'modifier']) {
    const { attacker, defender, conditions } = scenario();
    if (target === 'damage') attacker.rawDamageAtImpact = null;
    if (target === 'resistance') defender.effectiveResistancePercent.bullet = null;
    if (target === 'modifier') conditions.penetrationPercent = null;
    assert.equal(calculateSingleImpact(attacker, defender, conditions).status, 'incomplete');
  }
});

test('unverified penetration, amplification, special effects and headshots block numeric estimates', () => {
  for (const override of [{ penetrationPercent: 5 }, { amplificationPercent: 10 }, { specialEffects: ['proc'] }, { hitLocation: 'head' }]) {
    const { attacker, defender, conditions } = scenario();
    const result = calculateSingleImpact(attacker, defender, { ...conditions, ...override });
    assert.equal(result.status, 'unsupported');
    assert.equal(result.estimate, null);
  }
});

test('different game or normalization versions cannot be compared', () => {
  for (const override of [{ clientVersion: 6711 }, { normalizerVersion: '0.2.0' }, { sourceSnapshotHash: 'b'.repeat(64) }]) {
    const { attacker, defender, conditions } = scenario();
    Object.assign(defender.build, override);
    assert.equal(calculateSingleImpact(attacker, defender, conditions).status, 'invalid');
  }
});

test('build provenance and level must be valid even if both inputs agree', () => {
  for (const override of [{ clientVersion: 0 }, { normalizerVersion: '' }, { sourceSnapshotHash: '' }, { level: 1.5 }]) {
    const { attacker, defender, conditions } = scenario();
    Object.assign(attacker.build, override);
    Object.assign(defender.build, override);
    assert.equal(calculateSingleImpact(attacker, defender, conditions).status, 'invalid');
  }
});

test('negative and non-finite inputs are rejected', () => {
  for (const value of [-1, Infinity, NaN]) {
    const { attacker, defender, conditions } = scenario();
    attacker.rawDamageAtImpact = value;
    assert.equal(calculateSingleImpact(attacker, defender, conditions).status, 'invalid');
  }
});
