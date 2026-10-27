import { COMBO_RULES as R } from './bebopComboRules';
import { resolveUpgradeRelations } from './itemUpgrades';
import { DEFENDER_RULES } from './defenderRules';

export type ComboDamageType = 'bullet' | 'spirit' | 'melee';
export type Ability = 'uppercut' | 'bomb' | 'hook' | 'beam';
export type ComboAttack = 'shot' | Ability;
export const COMBO_MODEL = 'bebop-combo-6819-v1';
export const COMBO_ITEMS = R.items;
const relations = resolveUpgradeRelations(R.items.map(i => ({ id: i.id, className: i.className, componentClassNames: [...i.components] })));

export interface ComboBuild {
  heroId: string;
  level: number;
  itemIds: string[];
  stages: Record<Ability, number>;
  // Resolved additions only. "excluded" is a deliberate scenario, not an inferred zero.
  purchaseMode: 'excluded' | 'resolved';
  purchase: { health: number | null; spirit: number | null; shot: number | null };
}
export interface ComboScenario {
  clientVersion: number;
  sourceHash: string;
  attacker: ComboBuild;
  defender: ComboBuild;
  defense: {
    finalResistance: Record<ComboDamageType, number | null>;
    belowResistance: { bullet: number | null; spirit: number | null };
    shields: Record<ComboDamageType, number | null>;
    startHealthPercent: number | null;
  };
  bombBonusPercent: number | null;
  beamSeconds: number | null;
  // Additional travel time is explicitly supplied, not inferred from range.
  hookTravelSeconds: number | null;
  penetrationPercent: number | null;
  amplificationPercent: number | null;
  hitLocation: 'body' | 'head';
}
export interface ComboStats {
  maxHealth: number; spirit: number; shot: number; lightMelee: number;
  bulletSources: number[]; spiritSources: number[];
  thresholds: { bullet: number | null; spirit: number | null };
  contributions: Array<{ label: string; health: number; spirit: number; shot: number }>;
}
export interface ResolvedCombo {
  attacker: ComboStats; defender: ComboDefenseStats;
  resistance: Record<ComboDamageType, number>;
  belowResistance: { bullet: number; spirit: number };
}
export interface ComboHit {
  id: number; atMs: number; attack: ComboAttack; type: ComboDamageType;
  raw: number; resistance: number; afterResistance: number;
  shieldDamage: number; healthDamage: number; overkill: number;
  healthAfter: number; belowThreshold: boolean; formula: string;
}
interface PendingHit { order: number; atMs: number; attack: ComboAttack; type: ComboDamageType; raw: number; formula: string }
export interface ComboState {
  modelVersion: typeof COMBO_MODEL;
  scenario: ComboScenario; resolved: ResolvedCombo;
  timeMs: number; health: number; shields: Record<ComboDamageType, number>;
  ammo: number; gunSpun: boolean; nextShotMs: number;
  readyAt: Record<Ability, number>; weaponBuffUntil: number; hookAmpUntil: number;
  pending: PendingHit[]; sequence: number; hits: ComboHit[];
  cumulative: { raw: number; afterResistance: number; health: number; shield: number; overkill: number };
  bombHits: number;
  firing: { startedAtMs: number; elapsedMs: number; nextShotAtMs: number; shots: number } | null;
}
export type ComboAction = { kind: ComboAttack | 'reload' | 'reset' | 'startFire' } | { kind: 'wait'; seconds: number } | { kind: 'tickFire' | 'stopFire'; elapsedMs: number };
export interface ComboTransition { state: ComboState; accepted: boolean; reason: string | null }

export function defaultComboScenario(): ComboScenario {
  const build = (): ComboBuild => ({ heroId: '15', level: 1, itemIds: [], stages: { uppercut: 0, bomb: 0, hook: 0, beam: 0 }, purchaseMode: 'excluded', purchase: { health: null, spirit: null, shot: null } });
  return {
    clientVersion: R.clientVersion, sourceHash: R.sourceHash, attacker: build(), defender: build(),
    defense: { finalResistance: { bullet: null, spirit: null, melee: 0 }, belowResistance: { bullet: null, spirit: null }, shields: { bullet: 0, spirit: 0, melee: 0 }, startHealthPercent: 100 },
    bombBonusPercent: 0, beamSeconds: 2, hookTravelSeconds: 0,
    penetrationPercent: 0, amplificationPercent: 0, hitLocation: 'body',
  };
}

export function selectComboItem(build: ComboBuild, id: string): { build: ComboBuild; reason: string | null } {
  if (!relations[id] || relations[id].status !== 'resolved') return { build, reason: '未対応または構成元が未解決のアイテムです。' };
  if (build.itemIds.includes(id)) return { build: { ...build, itemIds: build.itemIds.filter(x => x !== id) }, reason: null };
  if (build.itemIds.some(x => relations[x]?.ancestorIds.includes(id))) return { build, reason: '上位アイテムを所持しているため、構成元は追加できません。' };
  const remaining = build.itemIds.filter(x => !relations[id].ancestorIds.includes(x));
  if (remaining.length >= 12) return { build, reason: '12枠が埋まっています。' };
  return { build: { ...build, itemIds: [...remaining, id] }, reason: null };
}

function finite(n: number | null | undefined, min = 0, max = 1e7): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}
function buildIssues(build:ComboBuild,heroAllowed:boolean):string[] {
  const issues: string[] = [];
  if (!heroAllowed) issues.push('選択ヒーローはこの側の計算モデルに未対応です。');
  if (!Number.isInteger(build.level) || build.level < 1 || build.level > 36) issues.push('ブーンは1〜36の整数で指定してください。');
  if (build.itemIds.length > 12 || new Set(build.itemIds).size !== build.itemIds.length) issues.push('アイテムの重複または枠数が不正です。');
  for (const key of ['uppercut', 'bomb', 'hook', 'beam'] as const) if (!Number.isInteger(build.stages[key]) || build.stages[key] < 0 || build.stages[key] > 3) issues.push(`${key}: 強化段階は0〜3です。`);
  for (const id of build.itemIds) {
    if (!R.items.some(i => i.id === id)) issues.push(`未対応アイテム: ${id}。効果を0として扱いません。`);
    if (relations[id]?.ancestorIds.some(x => build.itemIds.includes(x))) issues.push('上位アイテムと構成元は併用できません。');
  }
  if (!['excluded', 'resolved'].includes(build.purchaseMode)) issues.push('購入ボーナスの扱いが未指定です。');
  if (build.purchaseMode === 'resolved' && Object.values(build.purchase).some(n => !finite(n))) issues.push('購入ボーナスは確認済みの加算値をすべて入力してください。');
  return issues;
}
export function assembleComboBuild(build: ComboBuild): { stats: ComboStats | null; issues: string[] } {
  const issues=buildIssues(build,build.heroId==='15');
  if (issues.length) return { stats: null, issues };
  const n = build.level - 1;
  const contributions = [{ label: 'Bebop 基礎＋ブーン成長（加算の仮定）', health: R.hero.health + n * R.hero.growth.health, spirit: n * R.hero.growth.spirit, shot: R.weapon.damage + n * R.hero.growth.shot }];
  const bulletSources = n ? [n * R.hero.growth.bulletResistance] : [];
  const spiritSources: number[] = [];
  const thresholds: ComboStats['thresholds'] = { bullet: null, spirit: null };
  for (const id of build.itemIds) {
    const item = R.items.find(i => i.id === id)!;
    // These are reviewed absence-of-effect fields, not unknown property values.
    contributions.push({ label: item.name, health: item.health ?? 0, spirit: item.spirit ?? 0, shot: 0 });
    if (item.bullet !== null) { bulletSources.push(item.bullet); thresholds.bullet = item.threshold; }
    if (item.spiritResist !== null) { spiritSources.push(item.spiritResist); thresholds.spirit = item.threshold; }
  }
  if (build.purchaseMode === 'resolved') contributions.push({ label: '入力済み購入ボーナス加算', health: build.purchase.health!, spirit: build.purchase.spirit!, shot: build.purchase.shot! });
  const sum = (key: 'health' | 'spirit' | 'shot') => contributions.reduce((s, c) => s + c[key], 0);
  const stats: ComboStats = { maxHealth: sum('health'), spirit: sum('spirit'), shot: sum('shot'), lightMelee: R.hero.lightMelee + n * R.hero.growth.lightMelee, bulletSources, spiritSources, thresholds, contributions };
  if (![stats.maxHealth, stats.spirit, stats.shot, stats.lightMelee].every(x => finite(x))) return { stats: null, issues: ['ステータスが計算上限を超えています。'] };
  return { stats, issues };
}

export interface ComboDefenseStats {
  heroId:string; name:string; image:string; maxHealth:number;
  bulletSources:number[]; spiritSources:number[]; thresholds:ComboStats['thresholds'];
}
export function assembleComboDefense(build:ComboBuild):{stats:ComboDefenseStats|null;issues:string[]} {
  const hero=DEFENDER_RULES[build.heroId as keyof typeof DEFENDER_RULES];
  const issues=buildIssues(build,!!hero);
  if(issues.length||!hero)return {stats:null,issues};
  const n=build.level-1;
  let health=hero.health+n*hero.healthGrowth;
  const bulletSources=hero.bulletGrowth&&n?[n*hero.bulletGrowth]:[];
  const spiritSources=hero.spiritGrowth&&n?[n*hero.spiritGrowth]:[];
  const thresholds:ComboStats['thresholds']={bullet:null,spirit:null};
  for(const id of build.itemIds){
    const item=R.items.find(i=>i.id===id)!;
    health+=item.health??0; // Reviewed absence of HP contribution for the five supported items.
    if(item.bullet!==null){bulletSources.push(item.bullet);thresholds.bullet=item.threshold;}
    if(item.spiritResist!==null){spiritSources.push(item.spiritResist);thresholds.spirit=item.threshold;}
  }
  if(build.purchaseMode==='resolved')health+=build.purchase.health!;
  if(!finite(health))return {stats:null,issues:['HPが計算上限を超えています。']};
  return {stats:{heroId:hero.id,name:hero.name,image:hero.image,maxHealth:health,bulletSources,spiritSources,thresholds},issues};
}

export function resolveComboScenario(s: ComboScenario): { resolved: ResolvedCombo | null; issues: string[] } {
  const a = assembleComboBuild(s.attacker), d = assembleComboDefense(s.defender);
  const issues = [...a.issues.map(x => `自分: ${x}`), ...d.issues.map(x => `相手: ${x}`)];
  if (s.clientVersion !== R.clientVersion || s.sourceHash !== R.sourceHash) issues.push('データの版・出典ハッシュが一致しません。');
  if (s.hitLocation !== 'body' || s.penetrationPercent !== 0 || s.amplificationPercent !== 0) issues.push('ヘッドショット・追加貫通・追加増幅は未対応です。');
  if (!finite(s.bombBonusPercent, 0, 1000)) issues.push('爆弾の確認済み永久ボーナスを0〜1000%で指定してください。');
  if (!finite(s.beamSeconds, 0.1, R.beam.AbilityChannelTime) || Math.abs(s.beamSeconds! * 10 - Math.round(s.beamSeconds! * 10)) > 1e-8) issues.push('ビーム照射は0.1〜11秒、0.1秒単位で指定してください。');
  if (!finite(s.hookTravelSeconds, 0, 5)) issues.push('フックの追加飛翔時間を0〜5秒で指定してください。');
  if (!finite(s.defense.startHealthPercent, 0.1, 100)) issues.push('開始HPは0より大きく100%以下で指定してください。');
  for (const type of ['bullet', 'spirit', 'melee'] as const) if (!finite(s.defense.shields[type])) issues.push(`${type}: シールド量を明示してください。`);
  const resistance = { bullet: 0, spirit: 0, melee: 0 };
  const belowResistance = { bullet: 0, spirit: 0 };
  for (const type of ['bullet', 'spirit', 'melee'] as const) {
    const input = s.defense.finalResistance[type];
    const sources = type === 'melee' ? [] : (d.stats?.[type === 'bullet' ? 'bulletSources' : 'spiritSources'] ?? []);
    if (input !== null) {
      if (!finite(input, -100, 100)) issues.push(`${type}: 最終耐性は-100〜100%で入力してください。`);
      else resistance[type] = input;
    } else if (type === 'melee' || sources.length > 1) issues.push(`${type}: 合成後の最終耐性が未確認です。入力してください。`);
    else resistance[type] = sources[0] ?? 0; // Explicit no-base-resistance scenario, documented in UI.
    if (type !== 'melee') {
      const low = s.defense.belowResistance[type];
      if (d.stats?.thresholds[type] !== null && d.stats?.thresholds[type] !== undefined) {
        if (!finite(low, -100, 100)) issues.push(`${type}: 低HP時の最終耐性が未確認です。30+15の合成を推測しません。`);
        else belowResistance[type] = low;
      } else belowResistance[type] = resistance[type];
    }
  }
  return { resolved: issues.length || !a.stats || !d.stats ? null : { attacker: a.stats, defender: d.stats, resistance, belowResistance }, issues };
}

export function createCombo(scenario: ComboScenario): { state: ComboState | null; issues: string[] } {
  const { resolved, issues } = resolveComboScenario(scenario);
  if (!resolved) return { state: null, issues };
  // Freeze the input snapshot by copying, so edits cannot change an in-flight combo.
  const copy = JSON.parse(JSON.stringify(scenario)) as ComboScenario;
  return { issues, state: {
    modelVersion: COMBO_MODEL, scenario: copy, resolved,
    timeMs: 0, health: resolved.defender.maxHealth * copy.defense.startHealthPercent! / 100,
    shields: { bullet: copy.defense.shields.bullet!, spirit: copy.defense.shields.spirit!, melee: copy.defense.shields.melee! },
    ammo: R.weapon.ammo, gunSpun: false, nextShotMs: 0,
    readyAt: { uppercut: 0, bomb: 0, hook: 0, beam: 0 }, weaponBuffUntil: 0, hookAmpUntil: 0,
    pending: [], sequence: 0, hits: [], bombHits: 0, firing: null,
    cumulative: { raw: 0, afterResistance: 0, health: 0, shield: 0, overkill: 0 },
  } };
}

function impact(s: ComboState, event: PendingHit) {
  if (s.health <= 0) return;
  const threshold = event.type === 'melee' ? null : s.resolved.defender.thresholds[event.type];
  const below = threshold !== null && s.health / s.resolved.defender.maxHealth * 100 < threshold;
  const resistance = below && event.type !== 'melee' ? s.resolved.belowResistance[event.type] : s.resolved.resistance[event.type];
  const afterResistance = event.raw * (1 - resistance / 100);
  const shieldDamage = Math.min(s.shields[event.type], afterResistance);
  const healthDamage = Math.min(s.health, afterResistance - shieldDamage);
  const overkill = Math.max(0, afterResistance - shieldDamage - healthDamage);
  s.health -= healthDamage; s.shields[event.type] -= shieldDamage;
  s.cumulative.raw += event.raw; s.cumulative.afterResistance += afterResistance;
  s.cumulative.health += healthDamage; s.cumulative.shield += shieldDamage; s.cumulative.overkill += overkill;
  s.hits.push({ id: ++s.sequence, atMs: event.atMs, attack: event.attack, type: event.type, raw: event.raw, resistance, afterResistance, shieldDamage, healthDamage, overkill, healthAfter: s.health, belowThreshold: below, formula: event.formula });
  s.hits = s.hits.slice(-200);
  if (event.attack === 'bomb') s.bombHits++;
}
function advance(s: ComboState, target: number, stopAtDeath = false) {
  s.pending.sort((a, b) => a.atMs - b.atMs || a.order - b.order);
  while (s.pending[0]?.atMs <= target) {
    const e = s.pending.shift()!;
    s.timeMs = e.atMs;
    impact(s, e);
    if (stopAtDeath && s.health <= 0) return;
  }
  s.timeMs = target;
}
function queue(s: ComboState, attack: ComboAttack, type: ComboDamageType, raw: number, atMs: number, formula: string) {
  s.pending.push({ order: ++s.sequence, attack, type, raw, atMs, formula });
}
export function nextComboShotAt(s: ComboState): number {
  return Math.max(s.timeMs, s.nextShotMs) + (s.gunSpun ? 0 : Math.round((s.weaponBuffUntil > s.timeMs ? R.weapon.fastWindup : R.weapon.windup)*1000));
}
function fireShot(s: ComboState, at: number) {
  const a = s.resolved.attacker;
  let raw = a.shot;
  let formula = `${a.shot} 基礎射撃`;
  if (s.weaponBuffUntil > at) { raw += a.shot * R.uppercut.buffPercent/100; formula += ' × 1.30（Uppercut・単独バフの仮定）'; }
  if (s.hookAmpUntil > at) { raw *= 1 + R.hook.bulletAmpPercent/100; formula += ' × 1.20（Grapple・弾丸のみ）'; }
  queue(s, 'shot', 'bullet', raw, at, formula); advance(s, at);
  s.ammo--; s.gunSpun = true; s.nextShotMs = at + Math.round(R.weapon.cycle*1000);
}
export function transitionCombo(current: ComboState, action: ComboAction): ComboTransition {
  const reject = (reason: string): ComboTransition => ({ state: current, accepted: false, reason });
  if (action.kind === 'reset') return { state: createCombo(current.scenario).state!, accepted: true, reason: null };
  const firingAction = action.kind === 'tickFire' || action.kind === 'stopFire';
  if (firingAction && (!finite(action.elapsedMs, 0, 120000) || action.elapsedMs < (current.firing?.elapsedMs ?? 0))) return reject('射撃の経過時刻が不正です。');
  if (firingAction && !current.firing) return { state: current, accepted: true, reason: null };
  if (current.firing && !firingAction) return reject('射撃を離してから操作してください。');
  if (action.kind === 'wait' && (!finite(action.seconds, 0.01, 120))) return reject('待機時間は0.01〜120秒です。');
  if (current.health <= 0 && action.kind !== 'wait') return reject('相手のHPが0です。リセットしてください。');
  if (!['shot','uppercut','bomb','hook','beam','wait','reload','startFire','tickFire','stopFire'].includes(action.kind)) return reject('未対応の操作です。');
  if (['uppercut','bomb','hook','beam'].includes(action.kind) && current.readyAt[action.kind as Ability] > current.timeMs) return reject(`クールダウン中です。残り${((current.readyAt[action.kind as Ability]-current.timeMs)/1000).toFixed(2)}秒。`);
  if ((action.kind === 'shot' || action.kind === 'startFire') && current.ammo === 0) return reject('弾切れです。リロードしてください。');
  // All mutations below are on a fresh copy. Rejected operations preserve identity and state.
  const s: ComboState = { ...current, shields: { ...current.shields }, readyAt: { ...current.readyAt }, pending: current.pending.map(x=>({...x})), hits: [...current.hits], cumulative: { ...current.cumulative }, firing: current.firing ? {...current.firing} : null };
  if (action.kind === 'startFire') {
    s.firing = { startedAtMs: s.timeMs, elapsedMs: 0, nextShotAtMs: nextComboShotAt(s), shots: 0 };
    return { state: s, accepted: true, reason: null };
  }
  if (action.kind === 'tickFire' || action.kind === 'stopFire') {
    const hold = s.firing!;
    const target = hold.startedAtMs + Math.floor(action.elapsedMs);
    hold.elapsedMs = action.elapsedMs;
    while (hold.nextShotAtMs <= target && s.health > 0 && s.ammo > 0) {
      const at = hold.nextShotAtMs;
      advance(s, at, true);
      if (s.health <= 0) break;
      fireShot(s, at); hold.shots++; hold.nextShotAtMs = s.nextShotMs;
    }
    if (s.health > 0 && s.ammo > 0) advance(s, target, true);
    if (action.kind === 'stopFire' || s.health <= 0 || s.ammo === 0) { s.firing = null; s.gunSpun = false; }
    return { state: s, accepted: true, reason: null };
  }
  const stage = s.scenario.attacker.stages;
  const a = s.resolved.attacker;
  const started = s.timeMs;
  if (action.kind === 'wait') { s.gunSpun = false; advance(s, s.timeMs + Math.round(action.seconds*1000)); }
  else if (action.kind === 'reload') { s.gunSpun = false; advance(s, s.timeMs + Math.round(R.weapon.reload*1000)); s.ammo = R.weapon.ammo; }
  else if (action.kind === 'shot') {
    fireShot(s, nextComboShotAt(s));
  } else {
    s.gunSpun = false;
    if (action.kind === 'uppercut') {
      s.readyAt.uppercut = started + (R.uppercut.AbilityCooldown + (stage.uppercut >= 1 ? R.uppercut.cooldownUpgrade : 0))*1000;
      queue(s, 'uppercut', 'melee', a.lightMelee * R.uppercut.meleeScale, started, `${a.lightMelee} 軽近接 × ${R.uppercut.meleeScale}（主対象のみ）`);
      advance(s, started);
      if (stage.uppercut >= 2) s.weaponBuffUntil = started + R.uppercut.buffSeconds*1000;
      if (stage.uppercut >= 3) s.readyAt.hook = started;
    } else if (action.kind === 'bomb') {
      s.readyAt.bomb = started + (R.bomb.AbilityCooldown + (stage.bomb >= 1 ? R.bomb.cooldownUpgrade : 0))*1000;
      const base = R.bomb.Damage + (stage.bomb >= 2 ? R.bomb.damageUpgrade : 0) + R.bomb.spiritScale * a.spirit;
      const raw = base * (1 + s.scenario.bombBonusPercent!/100);
      queue(s, 'bomb', 'spirit', raw, started + R.bomb.FuseTime*1000, `(${R.bomb.Damage} + ${stage.bomb >= 2 ? R.bomb.damageUpgrade : 0} + ${R.bomb.spiritScale} × ${a.spirit}) × (1 + ${s.scenario.bombBonusPercent}/100)・ボーナス固定`);
    } else if (action.kind === 'hook') {
      s.readyAt.hook = started + (R.hook.AbilityCooldown + (stage.hook >= 3 ? R.hook.cooldownUpgrade : 0))*1000;
      const at = started + Math.round((R.hook.AbilityCastDelay + R.hook.HookImpactDelay + s.scenario.hookTravelSeconds!)*1000);
      queue(s, 'hook', 'melee', a.lightMelee * R.hook.meleeScale, at, `${a.lightMelee} 軽近接 × ${R.hook.meleeScale}・近接耐性は明示入力`);
      advance(s, at);
      if (stage.hook >= 1 && s.health > 0) s.hookAmpUntil = at + R.hook.bulletAmpSeconds*1000;
      advance(s, at + R.hook.AbilityPostCastDuration*1000);
    } else if (action.kind === 'beam') {
      s.readyAt.beam = started + (R.beam.AbilityCooldown + (stage.beam >= 1 ? R.beam.cooldownUpgrade : 0))*1000;
      const dps = R.beam.DPS + (stage.beam >= 2 ? R.beam.damageUpgrade : 0) + R.beam.spiritScale*a.spirit;
      const ticks = Math.round(s.scenario.beamSeconds!*10);
      for (let n=1; n<=ticks; n++) queue(s, 'beam', 'spirit', dps * R.beam.Interval, started + R.beam.AbilityCastDelay*1000 + n*100, `(${R.beam.DPS} + ${stage.beam >= 2 ? R.beam.damageUpgrade : 0} + ${R.beam.spiritScale} × ${a.spirit}) × 0.1秒・直撃のみ`);
      advance(s, started + R.beam.AbilityCastDelay*1000 + ticks*100);
    }
  }
  return { state: s, accepted: true, reason: null };
}
