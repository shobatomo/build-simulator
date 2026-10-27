import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {URL} from 'node:url';
import {Buffer} from 'node:buffer';
import {loadTs,plain} from './helpers/load-ts.mjs';
const C=loadTs('domain/comboCombat.ts'),B=loadTs('domain/builderTrial.ts'),S=loadTs('domain/builderSides.ts');
const R=loadTs('domain/defenderRules.ts').DEFENDER_RULES;
const payload=JSON.parse(readFileSync(new URL('../src/data/trialDisplay6819.payload.json',import.meta.url),'utf8'));
const data=JSON.parse(payload);
const provenance=JSON.parse(readFileSync(new URL('../src/data/trialDisplay6819.provenance.json',import.meta.url),'utf8'));
const {Response}=globalThis;
const buildInput=(heroId,selectedItems=[])=>({hero:data.heroes.find(h=>h.id===heroId),level:1,selectedItems,items:data.items,metadata:data.metadata,locale:'ja'});
test('default opponent is independently initialized as Infernus with no items',()=>{
 const sides=S.initialBuilderSides();assert.equal(sides.defender.heroId,'1');assert.equal(sides.defender.level,1);assert.deepEqual(plain(sides.defender.selection.items),[]);assert.notEqual(sides.attacker,sides.defender);assert.notEqual(sides.attacker.selection,sides.defender.selection);
 let state=S.updateBuilderSide(sides,'attacker',b=>({...b,heroId:'15',level:2}));state=S.updateBuilderSide(state,'defender',b=>({...b,level:9,selection:{items:[{instanceId:'d',itemId:'3633614685',enabledEffectIds:[]}],notice:null}}));
 assert.equal(state.attacker.heroId,'15');assert.equal(state.attacker.level,2);assert.equal(state.defender.level,9);assert.equal(state.defender.selection.items.length,1);assert.equal(sides.defender.level,1);
});
test('Infernus defense projection matches independently fetched fixed-version raw fields',()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/infernus-6819.public.json',import.meta.url),'utf8'));assert.equal(f.clientVersion,6819);assert.equal(String(f.hero.id),R['1'].id);assert.equal(f.hero.class_name,R['1'].className);
 assert.equal(f.hero.starting_stats.max_health.value,R['1'].health);assert.equal(f.hero.standard_level_up_upgrades.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL,R['1'].healthGrowth);assert.equal(f.hero.standard_level_up_upgrades.MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST,R['1'].bulletGrowth);assert.equal(f.hero.standard_level_up_upgrades.MODIFIER_VALUE_TECH_RESIST,R['1'].spiritGrowth);
 const s=B.defaultBuilderTrialScenario();let result=C.createCombo(s);assert.equal(result.state.health,830);assert.equal(result.state.resolved.defender.name,'Infernus');
 s.defender.level=2;s.defender.itemIds=['3633614685'];result=C.createCombo(s);assert.equal(result.state.health,830+39+210);assert.equal(result.state.resolved.resistance.bullet,0);
});
test('adding Infernus defense does not enable Infernus attacks or unknown opponents',()=>{
 const s=B.defaultBuilderTrialScenario();s.attacker.heroId='1';assert.equal(C.createCombo(s).state,null);s.attacker.heroId='15';s.defender.heroId='unknown';assert.equal(C.createCombo(s).state,null);
});
test('actual pinned display data can enter the trial without relabelling legacy data',()=>{
 const r=B.prepareBuilderTrial(B.captureBuilderTrial(buildInput('15'),B.defaultBuilderTrialScenario(),buildInput('1')));assert.deepEqual(plain(r.issues),[]);assert.equal(r.scenario.defender.heroId,'1');assert.equal(C.createCombo(r.scenario).state.health,830);
 const unknown=buildInput('15');unknown.metadata={source:data.metadata.source};assert.equal(B.prepareBuilderTrial(B.captureBuilderTrial(unknown,B.defaultBuilderTrialScenario(),buildInput('1'))).scenario,null);
});
test('opponent IDs, level and conditional toggles are validated independently from attacker',()=>{
 const opponent=buildInput('1',[{instanceId:'d',itemId:'3633614685',enabledEffectIds:[]}]);opponent.level=3;
 const r=B.prepareBuilderTrial(B.captureBuilderTrial(buildInput('15'),B.defaultBuilderTrialScenario(),opponent));assert.deepEqual(plain(r.issues),[]);assert.equal(r.scenario.attacker.level,1);assert.equal(r.scenario.attacker.itemIds.length,0);assert.equal(r.scenario.defender.level,3);assert.equal(C.createCombo(r.scenario).state.health,1118);
 const bad=buildInput('1',[{instanceId:'d',itemId:'no-such-item',enabledEffectIds:[]}]);const failed=B.prepareBuilderTrial(B.captureBuilderTrial(buildInput('15'),B.defaultBuilderTrialScenario(),bad));assert.equal(failed.scenario,null);assert.ok(failed.issues.some(i=>i.message.startsWith('相手：')));
});
test('opponent resilience requires explicit low-HP value, then applies the selected resistance',()=>{
 const opponent=buildInput('1',[{instanceId:'d',itemId:'3140772621',enabledEffectIds:[]}]);const config=B.defaultBuilderTrialScenario();let r=B.prepareBuilderTrial(B.captureBuilderTrial(buildInput('15'),config,opponent));assert.equal(r.scenario,null);
 config.defense.belowResistance.bullet=40.5;r=B.prepareBuilderTrial(B.captureBuilderTrial(buildInput('15'),config,opponent));assert.deepEqual(plain(r.issues),[]);const state=C.createCombo(r.scenario).state;assert.equal(state.resolved.resistance.bullet,30);assert.equal(state.resolved.belowResistance.bullet,40.5);assert.equal(state.health,830);
});
test('fixed catalog hashes, version provenance and response size match captured data',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),provenance.displaySha256);assert.equal(data.metadata.clientVersion,6819);assert.equal(data.metadata.snapshotHash,provenance.snapshotHash);assert.ok(Buffer.byteLength(JSON.stringify(data))<4000000);
 assert.equal(provenance.documents.length,5);for(const d of provenance.documents){const u=new URL(d.sourceUrl);assert.equal(u.origin,'https://api.deadlock-api.com');assert.equal(u.searchParams.get('client_version'),'6819');}
});
test('catalog GET preserves exact numeric payload, validates both hashes and has no POST export',async()=>{
 const load=(proof=provenance,catalog=payload)=>loadTs('app/api/trial-assets/6819/route.ts',{externals:{'../../../../data/trialDisplay6819.payload.json':catalog,'../../../../data/trialDisplay6819.provenance.json':proof,'next/server':{NextResponse:Response}}});
 const route=load();const response=await route.GET();assert.equal(response.status,200);assert.equal((await response.json()).metadata.clientVersion,6819);assert.equal(route.POST,undefined);assert.equal((await load({...provenance,displayCanonicalHash:'wrong'}).GET()).status,503);
 assert.equal(await load().GET().text(),payload);
 const changed=plain(data);changed.heroes[0].baseStats.health++;assert.equal((await load(provenance,JSON.stringify(changed)).GET()).status,503);
});
