import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,plain} from './helpers/load-ts.mjs';
const C=loadTs('domain/comboCombat.ts'), I=loadTs('domain/instantTrial.ts'), B=loadTs('domain/builderTrial.ts');
const R=loadTs('domain/bebopComboRules.ts').COMBO_RULES;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const make=(change=()=>{})=>{const s=C.defaultComboScenario();change(s);const r=I.createInstantTrial(s);assert.deepEqual(plain(r.issues),[]);return r.state;};
const act=(s,kind,more={})=>I.transitionInstantTrial(s,{kind,...more});
const input=()=>({hero:{id:'15',name:{ja:'ビバップ',en:'Bebop'}},level:1,locale:'ja',metadata:{clientVersion:6819,source:'https://api.deadlock-api.com/v1/assets'},selectedItems:[],items:R.items.map(i=>({id:i.id,className:i.className,name:{ja:i.name,en:i.name},effects:[]}))});
const capture=(change=()=>{},conditions=C.defaultComboScenario())=>{const x=input();change(x);return B.captureBuilderTrial(x,conditions);};
const checkIssue=(s,code)=>{const r=B.prepareBuilderTrial(s);assert.equal(r.scenario,null);assert.ok(r.issues.some(i=>i.code===code),JSON.stringify(r.issues));};

test('builder snapshot imports selected hero, level, IDs and copies every condition without mutating inputs',()=>{
 const x=input(),c=C.defaultComboScenario();x.level=4;x.selectedItems=[{instanceId:'a',itemId:'968099481',enabledEffectIds:[]}];c.attacker.stages.bomb=2;c.bombBonusPercent=25;c.defender.itemIds=['3633614685'];c.defense.shields.spirit=17;
 const snap=B.captureBuilderTrial(x,c),r=B.prepareBuilderTrial(snap);assert.deepEqual(plain(r.issues),[]);
 assert.equal(r.scenario.attacker.level,4);assert.deepEqual(plain(r.scenario.attacker.itemIds),['968099481']);assert.equal(r.scenario.attacker.stages.bomb,2);assert.equal(r.scenario.bombBonusPercent,25);assert.equal(r.scenario.defense.shields.spirit,17);
 x.selectedItems[0].enabledEffectIds.push('changed');c.defender.itemIds=[];assert.deepEqual(plain(snap.selectedItems[0].enabledEffectIds),[]);assert.deepEqual(plain(r.scenario.defender.itemIds),['3633614685']);assert.equal(snap.items.length,1);
});
test('unknown and mismatched builder versions or source cannot silently use pinned combat rules',()=>{
 for(const metadata of [null,{}, {source:'legacy'}])checkIssue(capture(x=>x.metadata=metadata),'version-unknown');
 for(const version of [6807,'6819',null])checkIssue(capture(x=>x.metadata={clientVersion:version}),'version-mismatch');
 checkIssue(capture(x=>x.metadata.source='unknown'),'source-unverified');
});
test('unsupported hero and item report identity and produce no scenario',()=>{
 checkIssue(capture(x=>x.hero={id:'1',name:{ja:'別ヒーロー',en:'Other'}}),'unsupported-hero');
 const s=capture(x=>{x.items.push({id:'999',name:{ja:'未対応品',en:'Other'},effects:[]});x.selectedItems=[{instanceId:'a',itemId:'999',enabledEffectIds:[]}];});checkIssue(s,'unsupported-item');assert.ok(B.prepareBuilderTrial(s).issues.some(i=>i.message.includes('未対応品')));
});
test('missing/duplicate definitions, wrong class and duplicate selections fail closed',()=>{
 const s=capture(x=>x.selectedItems=[{instanceId:'a',itemId:'968099481',enabledEffectIds:[]}]);
 for(const mutate of [x=>x.items=[],x=>x.items.push(x.items[0])]){const copy=plain(s);mutate(copy);checkIssue(copy,'missing-item');}
 const wrong=plain(s);wrong.items[0].className='wrong';checkIssue(wrong,'identity-mismatch');
 const dup=plain(s);dup.selectedItems.push({...dup.selectedItems[0],instanceId:'b'});checkIssue(dup,'invalid-selection');
});
test('conditional ON and unknown effect are refused; OFF remains captured and off',()=>{
 const s=capture(x=>{x.selectedItems=[{instanceId:'a',itemId:'968099481',enabledEffectIds:[]}];x.items.find(i=>i.id==='968099481').effects=[{id:'condition',name:{ja:'条件効果',en:'Conditional'},conditional:true}];});
 assert.ok(B.prepareBuilderTrial(s).scenario);assert.deepEqual(plain(s.selectedItems[0].enabledEffectIds),[]);
 s.selectedItems[0].enabledEffectIds=['condition'];checkIssue(s,'unsupported-condition');s.selectedItems[0].enabledEffectIds=['missing'];checkIssue(s,'unknown-effect');
});
test('pending opponent and invalid existing resistance/bomb conditions cannot become zero defaults',()=>{
 checkIssue(capture(()=>{},null),'conditions-pending');
 for(const mutate of [s=>s.defense.finalResistance.melee=null,s=>s.bombBonusPercent=null,s=>{s.defender.itemIds=['3140772621'];},s=>s.attacker.purchaseMode='invalid']){const c=C.defaultComboScenario();mutate(c);checkIssue(capture(()=>{},c),'invalid-conditions');}
});
test('resolved purchase additions cannot be reused against a different attacker build',()=>{
 const c=C.defaultComboScenario();c.attacker.purchaseMode='resolved';c.attacker.purchase={health:0,spirit:1,shot:0};
 assert.ok(B.prepareBuilderTrial(capture(()=>{},c)).scenario);
 checkIssue(capture(x=>x.level=2,c),'stale-purchase');
 checkIssue(capture(x=>x.selectedItems=[{instanceId:'a',itemId:'968099481',enabledEffectIds:[]}],c),'stale-purchase');
});
test('Bomb applies now and repeated click has no cooldown, fuse, time progression or new stack',()=>{
 const start=make();let s=act(start,'bomb');near(s.receipt.rawTotal,85);near(s.battle.health,795);assert.equal(s.battle.timeMs,0);assert.equal(s.battle.pending.length,0);assert.equal(s.battle.readyAt.bomb,0);
 s=act(s,'bomb');near(s.total.hp,170);assert.equal(s.battle.bombHits,0);assert.equal(start.battle.health,880);assert.equal(start.receipt,null);assert.equal(s.flashes.length,1);
});
test('melee types stay separate and primary target never gets uppercut landing AoE',()=>{
 for(const [kind,raw] of [['uppercut',63],['hook',44.1]]){const s=act(make(x=>{x.defense.finalResistance.melee=20;x.defense.finalResistance.spirit=90;}),kind);near(s.receipt.rawTotal,raw);near(s.receipt.projectedTotal,raw*.8);assert.equal(s.receipt.type,'melee');assert.equal(s.receipt.packets,1);assert.equal(s.battle.timeMs,0);}
});
test('full Beam reports 1760 even when remaining HP is 880; all 110 packets retained',()=>{
 const s=act(make(),'beam');near(s.receipt.rawTotal,1760);near(s.receipt.projectedTotal,1760);near(s.receipt.hpLost,880);near(s.receipt.overkill,880);assert.equal(s.receipt.packets,110);assert.equal(s.battle.health,0);assert.equal(s.battle.timeMs,0);assert.equal(s.battle.scenario.beamSeconds,2);near(s.flashes.at(-1).damage,1760);
 const after=act(s,'bomb');assert.equal(after.receipt,s.receipt);assert.equal(after.total,s.total);
});
test('full Beam resistance, shields and excess are distinct and do not stop at death',()=>{
 const s=act(make(x=>{x.defense.finalResistance.spirit=20;x.defense.shields.spirit=10;}),'beam');near(s.receipt.projectedTotal,1408);near(s.receipt.shieldLost,10);near(s.receipt.hpLost,880);near(s.receipt.overkill,518);near(s.receipt.projectedTotal,s.receipt.hpLost+s.receipt.shieldLost+s.receipt.overkill);
});
test('Beam uses pre-packet HP threshold, including declared hypothetical remainder after HP0',()=>{
 const s=act(make(x=>{x.defender.itemIds=['2163598980'];x.defense.belowResistance.spirit=45;x.defense.startHealthPercent=50;}),'beam');
 near(s.receipt.projectedTotal,16*.7+109*16*.55);near(s.receipt.hpLost,440);assert.equal(s.battle.health,0);assert.ok(I.instantTrialNotes(s.battle.scenario).some(n=>n.includes('HP0以降')));
});
test('fixed bomb bonus and ranks are preserved; full Beam applies spirit and rank scaling',()=>{
 let s=make(x=>{x.attacker.itemIds=['968099481'];x.attacker.stages.bomb=2;x.attacker.stages.beam=2;x.bombBonusPercent=25;});
 s=act(s,'bomb');near(s.receipt.rawTotal,(85+85+15)*1.25);s=act(s,'beam');near(s.receipt.rawTotal,(160+108+2.511*10)*11);assert.equal(s.battle.scenario.bombBonusPercent,25);
});
test('temporary Uppercut/Hook buffs never become permanent and omissions are disclosed',()=>{
 let s=make(x=>{x.attacker.stages.uppercut=2;x.attacker.stages.hook=1;});const notes=I.instantTrialNotes(s.battle.scenario);assert.ok(notes.some(n=>n.includes('Uppercut')&&n.includes('未再現')));assert.ok(notes.some(n=>n.includes('Grapple')&&n.includes('未再現')));
 s=act(s,'uppercut');s=act(s,'hook');s=act(s,'shot');near(s.receipt.rawTotal,4.98);assert.equal(s.battle.weaponBuffUntil,0);assert.equal(s.battle.hookAmpUntil,0);
});
test('hold keeps windup/rate, blocks simultaneous ability and stops on release',()=>{
 let s=act(make(),'bomb');s=act(s,'startFire');s=act(s,'tickFire',{elapsedMs:299});assert.equal(s.battle.ammo,66);const blocked=act(s,'hook');assert.equal(blocked.battle,s.battle);
 s=act(s,'tickFire',{elapsedMs:384});assert.equal(s.battle.ammo,64);near(s.total.hp,85+2*4.98);s=act(s,'stopFire',{elapsedMs:384});assert.equal(s.battle.firing,null);assert.equal(act(s,'tickFire',{elapsedMs:2000}),s);
});
test('ammo empty stops; reset restores ammo, HP, shields, receipt and totals',()=>{
 const original=make(x=>x.defense.shields.bullet=2);let s=act(original,'startFire');s=act(s,'tickFire',{elapsedMs:10000});assert.equal(s.battle.ammo,0);assert.equal(s.battle.firing,null);near(s.total.raw,66*4.98);assert.equal(s.battle.shields.bullet,0);
 const denied=act(s,'reload');assert.equal(denied.battle,s.battle);s=act(s,'reset');assert.deepEqual(plain(s),plain(original));
});
test('held gun stops on death and stale ticks after reset do not fire',()=>{
 let s=make(x=>x.defense.startHealthPercent=.1);s=act(s,'startFire');s=act(s,'tickFire',{elapsedMs:1000});assert.equal(s.battle.health,0);assert.equal(s.battle.ammo,65);assert.equal(s.battle.firing,null);s=act(s,'reset');const next=act(s,'tickFire',{elapsedMs:2000});assert.equal(next,s);
});
test('coarse and fine hold clocks agree when combined with instant abilities',()=>{
 const start=act(act(make(),'hook'),'startFire');const coarse=act(start,'stopFire',{elapsedMs:1800});let fine=start;for(let ms=10;ms<1800;ms+=10)fine=act(fine,'tickFire',{elapsedMs:ms});fine=act(fine,'stopFire',{elapsedMs:1800});assert.deepEqual(plain(fine.total),plain(coarse.total));assert.deepEqual(plain(fine.battle),plain(coarse.battle));
});
test('100% resistance retains HP and full raw total without inventing damage',()=>{
 const s=act(make(x=>x.defense.finalResistance.spirit=100),'beam');near(s.receipt.rawTotal,1760);near(s.receipt.projectedTotal,0);assert.equal(s.battle.health,880);
});
