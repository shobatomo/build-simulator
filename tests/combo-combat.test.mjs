import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { loadTs, plain } from './helpers/load-ts.mjs';
const C=loadTs('domain/comboCombat.ts'), S=loadTs('domain/comboSession.ts'), R=loadTs('domain/bebopComboRules.ts').COMBO_RULES;
const scenario=()=>C.defaultComboScenario();
const make=(change=()=>{})=>{const x=scenario();change(x);const r=C.createCombo(x);assert.deepEqual(plain(r.issues),[]);return r.state;};
const act=(s,kind,more={})=>{const r=C.transitionCombo(s,{kind,...more});assert.equal(r.accepted,true,r.reason);return r.state;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('pinned projection matches public mechanical fixture and all four ability scalars',()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/bebop-combo-6819.public.json',import.meta.url),'utf8'));
 assert.equal(createHash('sha256').update(JSON.stringify(f)).digest('hex'),R.sourceHash);
 assert.equal(f.clientVersion,R.clientVersion);
 const p=(c,k)=>f.items.find(x=>x.class_name===c).properties[k];
 assert.equal(Number(p('citadel_ability_uppercut','UppercutDamage').value),.01);
 assert.equal(p('citadel_ability_uppercut','UppercutDamage').scale_function.specific_stat_scale_type,'ELightMeleeDamage');
 assert.equal(p('citadel_ability_hook','Damage').scale_function.stat_scale,R.hook.meleeScale);
 assert.equal(Number(p('citadel_ability_sticky_bomb','Damage').value),R.bomb.Damage);
 assert.equal(Number(p('citadel_ability_bebop_laser_beam','DPS').value),R.beam.DPS);
 assert.equal(Number(p('upgrade_improved_bullet_armor','BulletResistBelowThreshold').value),15);
 const weapon=f.items.find(i=>i.class_name==='citadel_weapon_bebop_set');
 for(const [key,raw] of Object.entries({damage:'damage_per_shot',cycle:'cycle_time',ammo:'clip_size',reload:'reload_duration'}))assert.equal(R.weapon[key],weapon.weapon_info[raw]);
 for(const [key,raw] of Object.entries({health:'BASE_HEALTH_FROM_LEVEL',shot:'BASE_BULLET_DAMAGE_FROM_LEVEL',spirit:'TECH_POWER',lightMelee:'BASE_MELEE_DAMAGE_FROM_LEVEL',bulletResistance:'BULLET_ARMOR_DAMAGE_RESIST'}))assert.equal(R.hero.growth[key],f.hero.standard_level_up_upgrades['MODIFIER_VALUE_'+raw]);
 for(const item of R.items){const raw=f.items.find(i=>String(i.id)===item.id);assert.equal(raw.class_name,item.className);assert.deepEqual(plain(item.components),raw.component_items);for(const [key,prop] of Object.entries({health:'BonusHealth',spirit:'TechPower',bullet:'BulletResist',spiritResist:'TechResist',threshold:'HealthThreshold'}))assert.equal(item[key],raw.properties[prop]?.value==null?null:Number(raw.properties[prop].value));}
 for(const [name,stage,property,value] of [['citadel_ability_uppercut',0,'AbilityCooldown',R.uppercut.cooldownUpgrade],['citadel_ability_uppercut',1,'BuffBaseWeaponPct',R.uppercut.buffPercent],['citadel_ability_uppercut',1,'UppercutBuffOnHit',R.uppercut.buffSeconds],['citadel_ability_sticky_bomb',1,'Damage',R.bomb.damageUpgrade],['citadel_ability_hook',0,'BulletAmp',R.hook.bulletAmpPercent],['citadel_ability_hook',0,'BulletAmpDuration',R.hook.bulletAmpSeconds],['citadel_ability_bebop_laser_beam',1,'DPS',R.beam.damageUpgrade]])assert.equal(Number(f.items.find(i=>i.class_name===name).upgrades[stage].property_upgrades.find(p=>p.name===property).bonus),value);
});
test('shot resolves 4.98 -> 3.984 at explicit 20% resistance; HP and shield persist',()=>{
 let s=make(x=>{x.defense.finalResistance.bullet=20;x.defense.shields.bullet=2;});
 s=act(s,'shot');const h=s.hits[0];near(h.raw,4.98);near(h.afterResistance,3.984);near(h.shieldDamage,2);near(h.healthDamage,1.984);near(s.health,878.016);assert.equal(s.timeMs,300);assert.equal(s.ammo,65);
 s=act(s,'shot');assert.equal(s.timeMs,384);near(s.cumulative.health,5.968);
});
test('requested example: resolved 10-damage shot becomes 8 against final 20% resistance',()=>{
 let s=make(x=>{x.attacker.purchaseMode='resolved';x.attacker.purchase={health:0,spirit:0,shot:5.02};x.defense.finalResistance.bullet=20;});s=act(s,'shot');near(s.hits[0].raw,10);near(s.hits[0].afterResistance,8);near(s.health,872);
});
test('each base ability works; uppercut excludes landing AoE and hook is not spirit damage',()=>{
 let s=make(x=>{x.defense.finalResistance.melee=20;x.defense.finalResistance.spirit=90;});
 s=act(s,'uppercut');near(s.hits[0].raw,63);near(s.hits[0].healthDamage,50.4);assert.equal(s.hits.length,1);
 s=act(s,'hook');near(s.hits[1].raw,44.1);near(s.hits[1].healthDamage,35.28);assert.equal(s.hits[1].type,'melee');assert.equal(s.timeMs,800);
 s=act(s,'bomb');assert.equal(s.hits.length,2);s=act(s,'wait',{seconds:3.5});near(s.hits[2].raw,85);assert.equal(s.hits[2].type,'spirit');
 s=act(s,'beam');assert.equal(s.hits.filter(h=>h.attack==='beam').length,20);near(s.hits.at(-1).raw,16);
});
test('bomb fuse, fixed saved bonus, spirit scaling and T2 are explicit',()=>{
 let s=make(x=>{x.attacker.itemIds=['968099481'];x.attacker.stages.bomb=2;x.bombBonusPercent=25;});
 s=act(s,'bomb');assert.equal(s.pending.length,1);assert.equal(s.health,880);
 s=act(s,'wait',{seconds:3.49});assert.equal(s.hits.length,0);
 s=act(s,'wait',{seconds:.01});near(s.hits[0].raw,(85+85+1.5*10)*1.25);assert.equal(s.bombHits,1);assert.equal(s.scenario.bombBonusPercent,25);
});
test('bomb resolves chronologically during channel, and beam uses 0.1s integration without AoE doubling',()=>{
 let s=make(x=>{x.beamSeconds=4;});s=act(s,'bomb');s=act(s,'beam');
 assert.equal(s.timeMs,5000);assert.equal(s.hits.filter(h=>h.attack==='beam').length,40);assert.equal(s.hits.filter(h=>h.attack==='bomb').length,1);
 assert.equal(s.hits.find(h=>h.attack==='beam').atMs,1100);
 assert.equal(s.hits.find(h=>h.attack==='bomb').atMs,3500);near(s.cumulative.raw,725);
 assert.ok(s.hits.every((h,i)=>i===0||h.atMs>=s.hits[i-1].atMs));
});
test('cooldown rejection is atomic; tier 3 uppercut resets hook',()=>{
 let s=make(x=>{x.attacker.stages.uppercut=3;x.attacker.stages.hook=3;});s=act(s,'hook');
 const failed=C.transitionCombo(s,{kind:'hook'});assert.equal(failed.accepted,false);assert.equal(failed.state,s);
 s=act(s,'uppercut');assert.equal(s.readyAt.hook,s.timeMs);s=act(s,'hook');assert.equal(s.hits.filter(h=>h.attack==='hook').length,2);
});
test('hook amp affects bullets only; uppercut buff expires and melee is not implicitly amplified',()=>{
 let s=make(x=>{x.attacker.stages.hook=1;x.attacker.stages.uppercut=2;});
 s=act(s,'hook');s=act(s,'uppercut');near(s.hits.at(-1).raw,63);
 s=act(s,'shot');near(s.hits.at(-1).raw,4.98*1.3*1.2);
 s=act(s,'wait',{seconds:10});s=act(s,'shot');near(s.hits.at(-1).raw,4.98);
});
test('resilience requires final low-HP resistance and never guesses 45 vs 40.5',()=>{
 const x=scenario();x.defender.itemIds=['3140772621'];let r=C.createCombo(x);assert.equal(r.state,null);assert.ok(r.issues.some(x=>x.includes('低HP')));
 x.defense.belowResistance.bullet=40.5;r=C.createCombo(x);assert.ok(r.state);assert.equal(r.state.resolved.resistance.bullet,30);
 x.defender.level=2;r=C.createCombo(x);assert.equal(r.state,null);assert.ok(r.issues.some(x=>x.includes('合成後')));
 x.defense.finalResistance.bullet=31;r=C.createCombo(x);assert.ok(r.state);
});
test('threshold uses pre-hit HP; exactly 50% stays normal and next hit uses supplied low value',()=>{
 let s=make(x=>{x.defender.itemIds=['3140772621'];x.defense.belowResistance.bullet=45;x.defense.startHealthPercent=50;});
 s=act(s,'shot');assert.equal(s.hits[0].resistance,30);assert.equal(s.hits[0].belowThreshold,false);
 s=act(s,'shot');assert.equal(s.hits[1].resistance,45);assert.equal(s.hits[1].belowThreshold,true);
});
test('type-specific shields are independent; input melee resistance is not inferred from bullet items',()=>{
 let s=make(x=>{x.defender.itemIds=['3140772621'];x.defense.belowResistance.bullet=45;x.defense.finalResistance.melee=10;x.defense.shields.spirit=50;x.defense.shields.melee=5;});
 s=act(s,'hook');near(s.hits[0].afterResistance,39.69);assert.equal(s.shields.spirit,50);near(s.hits[0].shieldDamage,5);
});
test('dead target clamps HP and records overkill without future phantom damage',()=>{
 let s=make(x=>{x.defense.startHealthPercent=1;});s=act(s,'beam');assert.equal(s.health,0);assert.equal(s.hits.length,1);near(s.cumulative.health,8.8);near(s.cumulative.overkill,7.2);
 assert.equal(C.transitionCombo(s,{kind:'shot'}).accepted,false);const before=s.cumulative.raw;s=act(s,'wait',{seconds:10});assert.equal(s.cumulative.raw,before);
});
test('negative resistance and 100% resistance are bounded and not rounded during accumulation',()=>{
 let s=make(x=>{x.defense.finalResistance.bullet=-25;});s=act(s,'shot');near(s.hits[0].afterResistance,6.225);
 s=make(x=>{x.defense.finalResistance.bullet=100;});s=act(s,'shot');assert.equal(s.health,880);assert.equal(s.hits[0].afterResistance,0);
});
test('ammo, reload and rapid repeated actions use current state, with explicit time progression',()=>{
 let s=make(x=>{x.defense.finalResistance.bullet=100;});for(let n=0;n<66;n++)s=act(s,'shot');assert.equal(s.ammo,0);assert.equal(C.transitionCombo(s,{kind:'shot'}).accepted,false);
 const t=s.timeMs;s=act(s,'reload');assert.equal(s.ammo,66);assert.equal(s.timeMs,t+2350);s=act(s,'shot');assert.equal(s.timeMs,t+2650);
});
test('reset clears pending bombs, buffs, cooldown, history and cumulative values',()=>{
 let s=make();s=act(s,'bomb');s=act(s,'shot');s=act(s,'reset');assert.equal(s.timeMs,0);assert.equal(s.health,880);assert.equal(s.ammo,66);assert.equal(s.pending.length,0);assert.equal(s.hits.length,0);assert.equal(s.readyAt.bomb,0);assert.equal(s.cumulative.raw,0);
});
test('unknown, invalid and unsupported inputs never produce a numeric battle',()=>{
 for(const change of [x=>x.clientVersion++,x=>x.sourceHash='0'.repeat(64),x=>x.attacker.heroId='1',x=>x.attacker.itemIds=['unknown'],x=>x.attacker.level=1.5,x=>x.attacker.stages.beam=4,x=>x.bombBonusPercent=null,x=>x.beamSeconds=.15,x=>x.beamSeconds=12,x=>x.defense.finalResistance.melee=null,x=>x.defense.finalResistance.bullet=Infinity,x=>x.defense.startHealthPercent=0,x=>x.defense.shields.spirit=null,x=>x.penetrationPercent=1,x=>x.amplificationPercent=1,x=>x.hitLocation='head',x=>{x.attacker.purchaseMode='resolved';}]) {const x=scenario();change(x);assert.equal(C.createCombo(x).state,null);}
});
test('explicit purchase additions and item health/spirit assemble separately by side',()=>{
 const s=make(x=>{x.attacker.itemIds=['7409189'];x.attacker.purchaseMode='resolved';x.attacker.purchase={health:10,spirit:7,shot:1};x.defender.itemIds=['3633614685'];});
 assert.equal(s.resolved.attacker.maxHealth,965);assert.equal(s.resolved.attacker.spirit,25);near(s.resolved.attacker.shot,5.98);assert.equal(s.resolved.defender.maxHealth,1090);assert.equal(s.health,1090);
});
test('component replacement and reverse rejection preserve existing policy',()=>{
 let b=scenario().attacker;b=C.selectComboItem(b,'968099481').build;b=C.selectComboItem(b,'7409189').build;assert.deepEqual(plain(b.itemIds),['7409189']);const result=C.selectComboItem(b,'968099481');assert.equal(result.build,b);assert.ok(result.reason);
 const x=scenario();x.attacker.itemIds=['968099481','7409189'];assert.equal(C.createCombo(x).state,null);
});
test('draft edits do not alter active battle; no attacks against stale build; reset is deterministic',()=>{
 let s=S.initialComboSession();s=S.comboSessionReducer(s,{type:'start'});s=S.comboSessionReducer(s,{type:'act',action:{kind:'bomb'}});
 const live=s.battle;s=S.comboSessionReducer(s,{type:'item',side:'defender',id:'3633614685'});assert.equal(s.battle,live);assert.equal(s.draft.attacker.itemIds.length,0);assert.equal(s.draft.defender.itemIds.length,1);
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'shot'}});assert.equal(s.battle,live);s=S.comboSessionReducer(s,{type:'start'});assert.equal(s.battle.pending.length,0);assert.equal(s.battle.health,1090);
 for(let n=0;n<4;n++)s=S.comboSessionReducer(s,{type:'act',action:{kind:'shot'}});assert.equal(s.battle.ammo,62);
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'reset'}});assert.equal(s.battle.ammo,66);assert.deepEqual(plain(s.flashes),[]);
});
test('in-flight scenario is isolated from caller mutation; invalid wait preserves state',()=>{
 const x=scenario();const s=C.createCombo(x).state;x.attacker.level=30;assert.equal(s.scenario.attacker.level,1);
 for(const seconds of [0,-1,NaN,Infinity,121])assert.equal(C.transitionCombo(s,{kind:'wait',seconds}).state,s);
});
