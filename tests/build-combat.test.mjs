import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs, plain } from './helpers/load-ts.mjs';
import { catalogFixture, buildFixture, contextFixture, conditionsFixture } from './helpers/bebop-fixture.mjs';
const { assembleBuild, calculateBuildImpact, BOMB_ID } = loadTs('domain/buildCombat.ts');
const catalog = await catalogFixture();
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const assemble = (build = {}, context = {}, source = catalog) => assembleBuild(source, buildFixture(source, build), contextFixture(build.itemIds ?? [], context));
function impact({ attacker = {}, defender = {}, attackerContext = {}, defenderContext = {}, attack = { kind: 'weapon-shot', permanentBombStacks: 0 }, conditions = {} } = {}) {
  return calculateBuildImpact(catalog, buildFixture(catalog, attacker), buildFixture(catalog, defender), contextFixture(attacker.itemIds ?? [], attackerContext), contextFixture(defender.itemIds ?? [], defenderContext), attack, conditionsFixture(conditions));
}
test('public 6819 projection assembles API health, weapon damage and standard level growth', () => {
  const result = assemble({ level: 2 });
  assert.equal(result.status, 'assumption-based', JSON.stringify(result.issues));
  close(result.stats.weaponShotDamage, 5.095);
  assert.deepEqual(plain({ ...result.stats, weaponShotDamage: undefined }), { health: 932, spiritPower: 1.1, resistancePercent: { bullet: 0.3, spirit: 0 }, shields: { bullet: 0, spirit: 0 } });
  assert.ok(result.contributions.some(c => c.source.includes('× 1')));
});
test('limited unupgraded items add health/spirit and retain purchase threshold evidence', () => {
  const result = assemble({ itemIds: ['3633614685', '968099481'] });
  assert.equal(result.status, 'assumption-based', JSON.stringify(result.issues));
  assert.equal(result.stats.health, 1090);
  assert.equal(result.stats.spiritPower, 10);
  assert.equal(result.purchaseEvidence.find(e=>e.slot==='vitality').threshold.bonus, 9);
  assert.equal(result.purchaseEvidence.find(e=>e.slot==='spirit').threshold.bonus, 7);
  assert.ok(result.assumptions.some(s=>s.includes('caller assumptions')));
});
test('purchase bonuses are never inferred from thresholds or legacy tiers', () => {
  const unknown = assemble({ itemIds: ['968099481'] }, { purchaseContributions: null });
  assert.equal(unknown.stats, null);
  assert.ok(unknown.issues.some(i=>i.code==='UNRESOLVED_COST_BONUSES'));
  const explicit = assemble({ itemIds: ['968099481'] }, { purchaseContributions: { healthFlat: 12, spiritFlat: 7, weaponDamageFlat: 2 } });
  assert.equal(explicit.stats.spiritPower, 17);
  assert.equal(explicit.stats.health, 892);
  close(explicit.stats.weaponShotDamage, 6.98);
});
test('unknown base spirit, resistance, shields or contribution values never become zero', () => {
  for (const context of [{baseSpiritPower:null}, {baseResistancePercent:{bullet:null,spirit:0}}, {shields:{bullet:0,spirit:null}}, {purchaseContributions:{healthFlat:null,spiritFlat:0,weaponDamageFlat:0}}]) {
    const result = assemble({}, context);
    assert.equal(result.status, 'incomplete'); assert.equal(result.stats, null);
  }
});
test('invalid/non-finite inputs, duplicate and over-capacity selections are rejected', () => {
  for (const build of [{level:0},{level:37},{level:1.5},{itemIds:['3633614685','3633614685']},{itemIds:Array.from({length:13},(_,i)=>String(i))},{sourceSnapshotHash:'f'.repeat(64)}]) assert.equal(assemble(build).status,'invalid');
  for (const context of [{baseSpiritPower:NaN},{baseSpiritPower:-1},{shields:{bullet:Infinity,spirit:0}}]) assert.equal(assemble({},context).status,'invalid');
});
test('unknown hero/item, unsupported version and component conflict cannot yield a total', async () => {
  assert.equal(assemble({heroId:'999'}).status,'invalid');
  assert.equal(assemble({itemIds:['unknown']}).status,'invalid');
  assert.equal(assemble({itemIds:['7409189']}).status,'unsupported');
  const conflict = assemble({itemIds:['968099481','7409189']});
  assert.ok(conflict.issues.some(i=>i.code==='COMPONENT_CONFLICT'));
  const next = plain(catalog); next.clientVersion++;
  assert.equal(assemble({}, {}, next).status,'unsupported');
});
test('new mechanics under the same version and unknown units fail closed for calculation', async () => {
  for (const change of [
    f => { f.itemsEnglish.find(i=>i.id===3633614685).properties.NewDamageBuff={value:30,tooltip_section:'innate'}; },
    f => { f.itemsEnglish.find(i=>i.id===3633614685).properties.BonusHealth.value='210m'; },
    f => { f.itemsEnglish.find(i=>i.id===3633614685).properties.BonusHealth.conditional='only while airborne'; },
    f => { f.itemsEnglish.find(i=>i.id===3633614685).new_combat_effect={damageMultiplier:2}; },
    f => { f.heroesEnglish[0].standard_level_up_upgrades.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL='?'; },
  ]) {
    const changed = await catalogFixture(change);
    assert.equal(assemble({itemIds:['3633614685']},{},changed).status,'unsupported');
  }
});
test('item upgrade stages, partial health and unreviewed ability stages are explicit unsupported', () => {
  assert.equal(assemble({itemIds:['968099481']},{itemUpgradeStages:{}}).status,'incomplete');
  assert.equal(assemble({itemIds:['968099481']},{itemUpgradeStages:{'968099481':1}}).status,'unsupported');
  assert.equal(assemble({}, {healthState:'half'}).status,'unsupported');
  assert.equal(assemble({abilityStages:{[BOMB_ID]:3}}).status,'unsupported');
  assert.equal(assemble({abilityStages:{unknown:0}}).status,'unsupported');
});
test('a single resistance source is applied; stacking needs an explicit resolved value', () => {
  const one = assemble({itemIds:['3140772621']});
  assert.equal(one.stats.resistancePercent.bullet,30);
  const two = assemble({itemIds:['3140772621'],level:2});
  assert.equal(two.stats,null); assert.ok(two.issues.some(i=>i.code==='RESISTANCE_STACKING'));
  const resolved = assemble({itemIds:['3140772621'],level:2},{resolvedResistancePercent:{bullet:30.21}});
  assert.equal(resolved.stats.resistancePercent.bullet,30.21);
});
test('one body shot uses the opposing build and shield before HP', () => {
  const result=impact({defender:{itemIds:['3140772621']},defenderContext:{shields:{bullet:2,spirit:0}}});
  assert.equal(result.status,'assumption-based',JSON.stringify(result.issues));
  close(result.rawDamage,4.98); close(result.impact.estimate.damageAfterResistance,3.486);
  close(result.impact.estimate.shieldDamage,2); close(result.impact.estimate.healthDamage,1.486);
});
test('Sticky Bomb uses API damage, spirit scaling and purchased ability upgrade stages', () => {
  for (const [stage,expected] of [[0,100],[1,100],[2,185]]) {
    const result=impact({attacker:{itemIds:['968099481'],abilityStages:{[BOMB_ID]:stage}},defender:{itemIds:['2163598980']},defenderContext:{shields:{bullet:0,spirit:10}},attack:{kind:'sticky-bomb',permanentBombStacks:0}});
    assert.equal(result.status,'assumption-based',JSON.stringify(result.issues));
    close(result.rawDamage,expected); close(result.impact.estimate.damageAfterResistance,expected*0.7);
    close(result.impact.estimate.healthDamage,expected*0.7-10);
  }
});
test('ability missing rank or permanent stacks do not silently select zero', () => {
  assert.equal(impact({attacker:{abilityStages:{}},attack:{kind:'sticky-bomb',permanentBombStacks:0}}).status,'incomplete');
  assert.equal(impact({attack:{kind:'sticky-bomb',permanentBombStacks:null}}).status,'incomplete');
  assert.equal(impact({attack:{kind:'sticky-bomb',permanentBombStacks:1}}).status,'unsupported');
});
test('distance, headshots, penetration, amplification and special effects are not estimated', () => {
  for (const conditions of [{distanceMeters:1},{hitLocation:'head'},{penetrationPercent:1},{amplificationPercent:1},{specialEffects:['debuff']}]) {
    const result=impact({conditions}); assert.equal(result.status,'unsupported'); assert.equal(result.rawDamage,null);
    assert.equal(result.impact?.estimate ?? null,null);
  }
  assert.equal(impact({conditions:{distanceMeters:null}}).status,'incomplete');
});
test('large explicit scenario damage reports overkill without negative health', () => {
  const result=impact({attackerContext:{purchaseContributions:{healthFlat:0,spiritFlat:0,weaponDamageFlat:1000}}});
  assert.equal(result.impact.estimate.remainingHealth,0); close(result.impact.estimate.overkill,124.98);
});
