import type { JsonObject, JsonValue, NormalizedCatalog, NormalizedItem, ParsedValue } from './assets/types';
import { objectValue, parseAssetValue } from './assets/values';
import { BEBOP_RULES } from './bebopRules';
import { calculateSingleImpact, type BuildSelection, type CombatConditions, type CombatResult, type DamageType } from './combat';
import { resolveUpgradeRelations } from './itemUpgrades';

export const BUILD_MODEL_VERSION = 'bebop-single-impact-6819-v1';
export const BEBOP_ID = '15';
export const BOMB_ID = '2521902222';
const WEAPON_ID = '3764085067';
const itemEffects: Record<string, { key: string; stat: 'health' | 'spirit' | DamageType }> = {
  '3633614685': { key: 'BonusHealth', stat: 'health' },
  '968099481': { key: 'TechPower', stat: 'spirit' },
  '3140772621': { key: 'BulletResist', stat: 'bullet' },
  '2163598980': { key: 'TechResist', stat: 'spirit' },
};

export interface BuildContext {
  // These base values are absent from the reviewed hero payload. Explicit scenario
  // assumptions are required; absence never means zero.
  baseSpiritPower: number | null;
  baseResistancePercent: Record<DamageType, number | null>;
  shields: Record<DamageType, number | null>;
  healthState: 'full';
  itemUpgradeStages: Record<string, number>;
  // Already-resolved TOTAL additions after any purchase-bonus operation. No tier,
  // percentage stacking, unit or operation is inferred from cost_bonuses.
  purchaseContributions: { healthFlat: number | null; spiritFlat: number | null; weaponDamageFlat: number | null } | null;
  resolvedResistancePercent?: Partial<Record<DamageType, number | null>>;
}

export interface BuildStats {
  health: number;
  spiritPower: number;
  weaponShotDamage: number;
  resistancePercent: Record<DamageType, number>;
  shields: Record<DamageType, number>;
}
export interface BuildIssue { status: 'invalid' | 'incomplete' | 'unsupported'; code: string; path: string }
export interface BuildAssembly {
  modelVersion: typeof BUILD_MODEL_VERSION;
  status: CombatResult['status'];
  stats: BuildStats | null;
  issues: BuildIssue[];
  contributions: Array<{ stat: string; value: number; source: string }>;
  purchaseEvidence: Array<{ slot: string; selectedItemCost: number; threshold: JsonValue }>;
  assumptions: string[];
}
const select = (value: JsonObject, keys: string[]): JsonObject => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
const omit = (value: JsonObject, keys: string[]): JsonObject => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const canonical = (value: JsonValue): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = objectValue(value);
  return object ? '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}' : JSON.stringify(value);
};
function reviewedItem(item: NormalizedItem): boolean {
  const raw = item.raw.english;
  const properties = raw && objectValue(raw.properties);
  if (!raw || !properties || !BEBOP_RULES.items[item.id]) return false;
  const mechanical = { ...omit(raw, BEBOP_RULES.itemPresentationKeys), properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, omit(objectValue(value) ?? {}, BEBOP_RULES.propertyPresentationKeys)])) };
  return canonical(mechanical) === canonical(BEBOP_RULES.items[item.id]);
}

// Accept catalogs produced by normalizeVerifiedSnapshot/verified repository reads.
// This pure layer has no fetch, environment, database, UI, or mutable global state.
export function assembleBuild(catalog: NormalizedCatalog, build: BuildSelection, context: BuildContext): BuildAssembly {
  const issues: BuildIssue[] = [];
  const contributions: BuildAssembly['contributions'] = [];
  const purchaseEvidence: BuildAssembly['purchaseEvidence'] = [];
  const assumptions = [
    'API-grounded scenario model; arithmetic and application order are not verified against the live game.',
    'Standard upgrades are counted from level_info and their listed values are treated as additive.',
    'Base spirit/resistance/shields and resolved purchase contributions are explicit caller assumptions.',
    'Full health at impact; no regeneration, item upgrade stages, debuffs, buff triggers, DPS or TTK.',
    'Resilience conditional bonuses are inactive at full health; no mid-hit threshold recalculation.',
  ];
  const issue = (status: BuildIssue['status'], code: string, path: string) => issues.push({ status, code, path });
  const finish = (stats: BuildStats | null = null): BuildAssembly => ({
    modelVersion: BUILD_MODEL_VERSION,
    status: issues.some(i => i.status === 'invalid') ? 'invalid' : issues.some(i => i.status === 'unsupported') ? 'unsupported' : issues.length ? 'incomplete' : 'assumption-based',
    stats: issues.length ? null : stats, issues, contributions, purchaseEvidence, assumptions,
  });
  const number = (value: number | null | undefined, path: string, min = 0, max = Infinity): number | null => {
    if (value == null) { issue('incomplete', 'UNKNOWN_VALUE', path); return null; }
    if (!Number.isFinite(value) || value < min || value > max) { issue('invalid', 'INVALID_NUMBER', path); return null; }
    return value;
  };
  const scalar = (value: ParsedValue | undefined, path: string, unit: string | null = null): number | null => {
    if (!value || value.status !== 'known') { issue('incomplete', 'UNKNOWN_VALUE', path); return null; }
    if (value.unit !== null && value.unit !== unit) { issue('unsupported', 'UNKNOWN_UNIT', path); return null; }
    return number(value.value, path);
  };
  const add = (stat: string, value: number | null, source: string) => { if (value !== null) contributions.push({ stat, value, source }); };
  if (build.clientVersion !== catalog.clientVersion || build.normalizerVersion !== catalog.normalizerVersion || build.sourceSnapshotHash !== catalog.sourceSnapshotHash || !/^[a-f0-9]{64}$/.test(build.sourceSnapshotHash)) issue('invalid', 'PROVENANCE_MISMATCH', 'build');
  if (catalog.clientVersion !== BEBOP_RULES.clientVersion || catalog.normalizerVersion !== BEBOP_RULES.normalizerVersion) issue('unsupported', 'UNREVIEWED_VERSION', 'catalog');
  const hero = catalog.heroes.find(h => h.id === build.heroId);
  if (!hero) issue('invalid', 'UNKNOWN_HERO', 'heroId');
  else if (hero.id !== BEBOP_ID || hero.className !== 'hero_bebop') issue('unsupported', 'UNSUPPORTED_HERO', 'heroId');
  if (!Number.isSafeInteger(build.level) || build.level < 1 || build.level > 36) issue('invalid', 'INVALID_LEVEL', 'level');
  if (build.itemIds.length > 12 || new Set(build.itemIds).size !== build.itemIds.length) issue('invalid', 'INVALID_ITEM_SELECTION', 'itemIds');
  if (context.healthState !== 'full') issue('unsupported', 'PARTIAL_HEALTH', 'healthState');
  for (const [id, stage] of Object.entries(build.abilityStages)) {
    if (id !== BOMB_ID || !Number.isSafeInteger(stage) || stage < 0 || stage > 2) issue('unsupported', 'UNSUPPORTED_ABILITY_STAGE', `abilityStages.${id}`);
  }
  for (const id of Object.keys(context.itemUpgradeStages)) if (!build.itemIds.includes(id)) issue('invalid', 'UNSELECTED_ITEM_STAGE', `itemUpgradeStages.${id}`);
  if (!hero || issues.length) return finish();
  if (!hero.raw.english || canonical(select(hero.raw.english, BEBOP_RULES.heroKeys)) !== canonical(BEBOP_RULES.hero)) {
    issue('unsupported', 'UNREVIEWED_HERO_MECHANICS', 'hero.raw'); return finish();
  }
  const relations = resolveUpgradeRelations(catalog.items);
  const selected: NormalizedItem[] = [];
  for (const id of build.itemIds) {
    const item = catalog.items.find(i => i.id === id);
    if (!item) { issue('invalid', 'UNKNOWN_ITEM', `items.${id}`); continue; }
    selected.push(item);
    if (relations[id]?.status !== 'resolved') issue('incomplete', 'UNRESOLVED_COMPONENTS', `items.${id}`);
    if (relations[id]?.ancestorIds.some(ancestor => build.itemIds.includes(ancestor))) issue('invalid', 'COMPONENT_CONFLICT', `items.${id}`);
    if (!Object.hasOwn(itemEffects, id) || !reviewedItem(item)) issue('unsupported', 'UNREVIEWED_ITEM_MECHANICS', `items.${id}`);
    if (context.itemUpgradeStages[id] == null) issue('incomplete', 'UNKNOWN_ITEM_STAGE', `itemUpgradeStages.${id}`);
    else if (context.itemUpgradeStages[id] !== 0) issue('unsupported', 'ITEM_UPGRADES', `itemUpgradeStages.${id}`);
  }
  const weapon = catalog.items.find(i => i.id === WEAPON_ID);
  if (!weapon || !reviewedItem(weapon)) issue('unsupported', 'UNREVIEWED_WEAPON', 'weapon');
  if (issues.length) return finish();
  const levelInfo = objectValue(hero.levelInfo);
  let upgrades = 0;
  for (let level = 2; level <= build.level; level++) {
    const entry = objectValue(levelInfo?.[String(level)]);
    if (!entry || typeof entry.use_standard_upgrade !== 'boolean') issue('incomplete', 'UNKNOWN_LEVEL_GROWTH', `level_info.${level}`);
    else if (entry.use_standard_upgrade) upgrades++;
  }
  const growth = (key: string, stat: string) => {
    const path = `standard_level_up_upgrades.MODIFIER_VALUE_${key}`;
    const perLevel = scalar(hero.standardLevelUpUpgrades[`MODIFIER_VALUE_${key}`], path);
    add(stat, perLevel === null ? null : perLevel * upgrades, path + ` × ${upgrades}`);
  };
  add('health', scalar(hero.startingStats.max_health?.value, 'starting_stats.max_health'), 'starting_stats.max_health');
  add('spiritPower', number(context.baseSpiritPower, 'baseSpiritPower'), 'context.baseSpiritPower');
  add('weaponShotDamage', scalar(parseAssetValue(objectValue(weapon!.weaponInfo)?.damage_per_shot), 'weapon_info.damage_per_shot'), 'weapon_info.damage_per_shot');
  growth('BASE_HEALTH_FROM_LEVEL', 'health');
  growth('TECH_POWER', 'spiritPower');
  growth('BASE_BULLET_DAMAGE_FROM_LEVEL', 'weaponShotDamage');
  const resistances: Record<DamageType, number | null> = { bullet: null, spirit: null };
  for (const type of ['bullet', 'spirit'] as const) {
    add(type + 'Resistance', number(context.baseResistancePercent[type], `baseResistancePercent.${type}`, -100, 100), `context.baseResistancePercent.${type}`);
    growth(type === 'bullet' ? 'BULLET_ARMOR_DAMAGE_RESIST' : 'TECH_RESIST', type + 'Resistance');
  }
  for (const item of selected) {
    const effect = itemEffects[item.id];
    const property = item.properties.find(p => p.key === effect.key);
    const stat = effect.key === 'TechResist' ? 'spiritResistance' : effect.stat === 'bullet' ? 'bulletResistance' : effect.stat === 'health' ? 'health' : 'spiritPower';
    add(stat, scalar(property?.value, `items.${item.id}.${effect.key}`, stat.endsWith('Resistance') ? '%' : null), `items.${item.id}.properties.${effect.key}`);
    // Category spend is evidence only. It does not establish the bonus unit,
    // operation, historical spend after selling, or a verified stacking order.
    const cost = scalar(item.cost, `items.${item.id}.cost`);
    if (cost !== null) {
      const slot = item.slotType ?? 'unknown';
      const row = purchaseEvidence.find(e => e.slot === slot);
      if (row) row.selectedItemCost += cost;
      else purchaseEvidence.push({ slot, selectedItemCost: cost, threshold: null });
    }
  }
  for (const evidence of purchaseEvidence) {
    const thresholds = objectValue(hero.costBonuses)?.[evidence.slot];
    if (Array.isArray(thresholds)) {
      evidence.threshold = thresholds.filter(row => typeof objectValue(row)?.gold_threshold === 'number' && Number(objectValue(row)!.gold_threshold) <= evidence.selectedItemCost)
        .sort((a, b) => Number(objectValue(b)!.gold_threshold) - Number(objectValue(a)!.gold_threshold))[0] ?? null;
    }
  }
  const purchase = context.purchaseContributions;
  if (selected.length && purchase === null) issue('incomplete', 'UNRESOLVED_COST_BONUSES', 'purchaseContributions');
  if (purchase) {
    for (const [key, stat] of [['healthFlat', 'health'], ['spiritFlat', 'spiritPower'], ['weaponDamageFlat', 'weaponShotDamage']] as const) add(stat, number(purchase[key], `purchaseContributions.${key}`), `context.purchaseContributions.${key}`);
  }
  for (const type of ['bullet', 'spirit'] as const) {
    const override = context.resolvedResistancePercent?.[type];
    const sources = contributions.filter(c => c.stat === type + 'Resistance' && c.value !== 0);
    if (override !== undefined) {
      resistances[type] = number(override, `resolvedResistancePercent.${type}`, -100, 100);
      assumptions.push(`${type} resistance is explicitly resolved by the caller; listed sources are not combined.`);
    } else if (sources.length > 1) issue('unsupported', 'RESISTANCE_STACKING', type + 'Resistance');
    else resistances[type] = sources[0]?.value ?? 0;
  }
  const shields = { bullet: number(context.shields.bullet, 'shields.bullet'), spirit: number(context.shields.spirit, 'shields.spirit') };
  const sum = (stat: string) => contributions.filter(c => c.stat === stat).reduce((total, c) => total + c.value, 0);
  const totals = { health: sum('health'), spiritPower: sum('spiritPower'), weaponShotDamage: sum('weaponShotDamage') };
  for (const [key, value] of Object.entries(totals)) number(value, `total.${key}`);
  for (const type of ['bullet', 'spirit'] as const) if (resistances[type] !== null) number(resistances[type], `total.${type}Resistance`, -100, 100);
  if (issues.length) return finish();
  return finish({ ...totals, resistancePercent: resistances as Record<DamageType, number>, shields: shields as Record<DamageType, number> });
}

export interface BuildAttack { kind: 'weapon-shot' | 'sticky-bomb'; permanentBombStacks: number | null }
export interface BuildImpact {
  modelVersion: typeof BUILD_MODEL_VERSION;
  status: CombatResult['status'];
  attacker: BuildAssembly;
  defender: BuildAssembly;
  rawDamage: number | null;
  impact: CombatResult | null;
  issues: BuildIssue[];
}
export function calculateBuildImpact(catalog: NormalizedCatalog, attackerBuild: BuildSelection, defenderBuild: BuildSelection,
  attackerContext: BuildContext, defenderContext: BuildContext, attack: BuildAttack, conditions: CombatConditions): BuildImpact {
  const attacker = assembleBuild(catalog, attackerBuild, attackerContext);
  const defender = assembleBuild(catalog, defenderBuild, defenderContext);
  const issues = [...attacker.issues, ...defender.issues];
  const finish = (rawDamage: number | null = null, impact: CombatResult | null = null): BuildImpact => ({
    modelVersion: BUILD_MODEL_VERSION, attacker, defender, rawDamage, impact, issues,
    status: issues.some(i => i.status === 'invalid') ? 'invalid' : issues.some(i => i.status === 'unsupported') ? 'unsupported' : issues.length ? 'incomplete' : impact?.status ?? 'incomplete',
  });
  const issue = (status: BuildIssue['status'], code: string, path: string) => issues.push({ status, code, path });
  // The API's weapon range uses unverified engine units. Bomb output is one
  // attached target explosion; other AoE targets, fuse timing and self damage are excluded.
  if (conditions.distanceMeters !== 0) issue(conditions.distanceMeters == null ? 'incomplete' : 'unsupported', 'DISTANCE_MODEL', 'distanceMeters');
  if (!attacker.stats || !defender.stats || issues.length) return finish();
  let damage = attacker.stats.weaponShotDamage;
  let type: DamageType = 'bullet';
  if (attack.kind === 'sticky-bomb') {
    type = 'spirit';
    const ability = catalog.items.find(i => i.id === BOMB_ID);
    if (!ability || !reviewedItem(ability)) { issue('unsupported', 'UNREVIEWED_ABILITY', BOMB_ID); return finish(); }
    const stage = attackerBuild.abilityStages[BOMB_ID];
    if (stage == null) issue('incomplete', 'UNKNOWN_ABILITY_STAGE', BOMB_ID);
    if (attack.permanentBombStacks == null) issue('incomplete', 'UNKNOWN_BOMB_STACKS', 'permanentBombStacks');
    else if (attack.permanentBombStacks !== 0) issue('unsupported', 'BOMB_STACKS', 'permanentBombStacks');
    const property = ability.properties.find(p => p.key === 'Damage');
    const scale = objectValue(property?.scaleFunction);
    if (property?.value.status !== 'known' || property.value.unit !== null || scale?.class_name !== 'scale_function_tech_damage' || scale.specific_stat_scale_type !== 'ETechPower' || typeof scale.stat_scale !== 'number') issue('unsupported', 'DAMAGE_SCALING', 'Damage.scale_function');
    let bonus = 0;
    for (const upgrade of ability.upgrades.slice(0, stage ?? 0)) {
      for (const prop of upgrade.properties) {
        if (prop.name === 'Damage' && prop.bonus.status === 'known' && prop.bonus.unit === null && prop.upgradeType === null && prop.scaleStatFilter === null) bonus += prop.bonus.value;
        else if (prop.name !== 'AbilityCooldown') issue('unsupported', 'ABILITY_UPGRADE_EFFECT', `upgrades.${upgrade.sourceIndex}`);
      }
    }
    if (issues.length) return finish();
    damage = (property!.value as Extract<ParsedValue, { status: 'known' }>).value + bonus + attacker.stats.spiritPower * Number(scale!.stat_scale);
  } else if (attack.kind !== 'weapon-shot') { issue('unsupported', 'ATTACK_KIND', 'kind'); return finish(); }
  const impact = calculateSingleImpact({ build: attackerBuild, kind: type === 'bullet' ? 'weapon-shot' : 'ability-hit', abilityId: type === 'spirit' ? BOMB_ID : undefined, damageType: type, rawDamageAtImpact: damage },
    { build: defenderBuild, health: defender.stats.health, applicableShield: defender.stats.shields[type], effectiveResistancePercent: defender.stats.resistancePercent }, conditions);
  return finish(impact.estimate ? damage : null, impact);
}
