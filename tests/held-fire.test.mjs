import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,plain} from './helpers/load-ts.mjs';
const {Event,EventTarget}=globalThis;
const C=loadTs('domain/comboCombat.ts'), S=loadTs('domain/comboSession.ts');
const {HoldFireController,bindHoldSafety}=loadTs('domain/holdFireController.ts');
const make=(change=()=>{})=>{const x=C.defaultComboScenario();change(x);const r=C.createCombo(x);assert.deepEqual(plain(r.issues),[]);return r.state;};
const act=(s,kind,more={})=>{const r=C.transitionCombo(s,{kind,...more});assert.equal(r.accepted,true,r.reason);return r.state;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('hold waits for windup then fires at 84ms intervals',()=>{
 let s=act(make(),'startFire');assert.equal(s.hits.length,0);
 s=act(s,'tickFire',{elapsedMs:299.999});assert.equal(s.ammo,66);
 s=act(s,'tickFire',{elapsedMs:300});assert.equal(s.ammo,65);assert.equal(s.hits[0].atMs,300);
 s=act(s,'tickFire',{elapsedMs:383});assert.equal(s.hits.length,1);
 s=act(s,'tickFire',{elapsedMs:384});assert.equal(s.hits.length,2);
 s=act(s,'tickFire',{elapsedMs:1000});assert.equal(s.hits.length,9);assert.equal(s.hits.at(-1).atMs,972);near(s.cumulative.health,9*4.98);
});
test('coarse scheduler frames and fine frames produce identical simulation state',()=>{
 const start=act(make(),'startFire');
 const coarse=act(start,'stopFire',{elapsedMs:2100});
 let fine=start;for(let t=7;t<2100;t+=7)fine=act(fine,'tickFire',{elapsedMs:t});fine=act(fine,'stopFire',{elapsedMs:2100});
 assert.deepEqual(plain(fine),plain(coarse));assert.equal(start.ammo,66);
});
test('release before windup causes no shot; restarting pays new windup',()=>{
 let s=act(make(),'startFire');s=act(s,'stopFire',{elapsedMs:150});assert.equal(s.ammo,66);assert.equal(s.timeMs,150);assert.equal(s.firing,null);
 s=act(s,'startFire');s=act(s,'tickFire',{elapsedMs:299});assert.equal(s.ammo,66);
 s=act(s,'stopFire',{elapsedMs:300});assert.equal(s.hits[0].atMs,450);assert.equal(s.ammo,65);
 const late=act(s,'tickFire',{elapsedMs:2000});assert.equal(late,s);
});
test('ammo stops the clock at last shot and reload starts another windup',()=>{
 let s=act(make(),'startFire');s=act(s,'tickFire',{elapsedMs:10000});
 assert.equal(s.ammo,0);assert.equal(s.timeMs,5760);assert.equal(s.firing,null);assert.equal(s.hits.length,66);
 assert.equal(C.transitionCombo(s,{kind:'startFire'}).accepted,false);
 s=act(s,'reload');s=act(s,'startFire');s=act(s,'tickFire',{elapsedMs:300});assert.equal(s.hits.at(-1).atMs,8410);
});
test('enemy death stops exactly once; overkill is not flashed as damage lost',()=>{
 let s=S.initialComboSession();s=S.comboSessionReducer(s,{type:'defense',patch:{startHealthPercent:.1}});s=S.comboSessionReducer(s,{type:'start'});
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'startFire'}});s=S.comboSessionReducer(s,{type:'act',action:{kind:'tickFire',elapsedMs:3000}});
 assert.equal(s.battle.health,0);assert.equal(s.battle.ammo,65);assert.equal(s.battle.timeMs,300);assert.equal(s.battle.firing,null);near(s.flashes[0].damage,.88);
});
test('pending bomb killing during gun windup prevents a phantom bullet',()=>{
 let s=make(x=>{x.defense.startHealthPercent=5;});s=act(s,'bomb');s=act(s,'wait',{seconds:3.3});s=act(s,'startFire');s=act(s,'tickFire',{elapsedMs:500});
 assert.equal(s.health,0);assert.equal(s.ammo,66);assert.equal(s.timeMs,3500);assert.equal(s.hits.length,1);assert.equal(s.hits[0].type,'spirit');assert.equal(s.firing,null);
});
test('held hits each apply resistance and type shield in chronological order',()=>{
 let s=make(x=>{x.defense.finalResistance.bullet=20;x.defense.shields.bullet=5;});s=act(s,'startFire');s=act(s,'stopFire',{elapsedMs:384});
 near(s.hits[0].shieldDamage,3.984);near(s.hits[1].shieldDamage,1.016);near(s.hits[1].healthDamage,2.968);assert.equal(s.shields.bullet,0);
});
test('uppercut fast windup remains 50ms and buff is evaluated at each scheduled hit',()=>{
 let s=make(x=>{x.attacker.stages.uppercut=2;});s=act(s,'uppercut');s=act(s,'wait',{seconds:8.9});s=act(s,'startFire');s=act(s,'stopFire',{elapsedMs:134});
 const shots=s.hits.filter(h=>h.attack==='shot');assert.deepEqual(plain(shots.map(h=>h.atMs)),[8950,9034]);near(shots[0].raw,4.98*1.3);near(shots[1].raw,4.98);
});
test('invalid or nonmonotonic elapsed values reject atomically and active hold blocks other actions',()=>{
 let s=act(make(),'startFire');s=act(s,'tickFire',{elapsedMs:500});
 for(const elapsedMs of [499,-1,NaN,Infinity,120001]){const r=C.transitionCombo(s,{kind:'tickFire',elapsedMs});assert.equal(r.accepted,false);assert.equal(r.state,s);}
 for(const kind of ['startFire','shot','reload','uppercut','bomb','hook','beam','wait'])assert.equal(C.transitionCombo(s,{kind,seconds:1}).accepted,false);
 s=act(s,'reset');assert.equal(s.firing,null);assert.equal(s.hits.length,0);assert.equal(act(s,'tickFire',{elapsedMs:1000}),s);
});
test('session flashes preserve actual types across simultaneous queued bomb and bullet impacts',()=>{
 let s=S.comboSessionReducer(S.initialComboSession(),{type:'start'});
 const send=(kind,rest={})=>{s=S.comboSessionReducer(s,{type:'act',action:{kind,...rest}});};
 send('bomb');send('wait',{seconds:3.15});send('startFire');send('tickFire',{elapsedMs:500});
 assert.ok(s.flashes.some(f=>f.type==='bullet'));assert.ok(s.flashes.some(f=>f.type==='spirit'&&f.damage===85));
 send('stopFire',{elapsedMs:500});send('uppercut');assert.equal(s.flashes.at(-1).type,'melee');near(s.flashes.at(-1).damage,63);
 s=S.comboSessionReducer(s,{type:'build',side:'defender',patch:{level:2}});assert.equal(s.dirty,true);assert.equal(s.battle.firing,null);assert.deepEqual(plain(s.flashes),[]);
});
test('visual hit cap never changes accumulated damage; reset discards all flashes and elapsed callbacks',()=>{
 let s=S.comboSessionReducer(S.initialComboSession(),{type:'start'});
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'startFire'}});s=S.comboSessionReducer(s,{type:'act',action:{kind:'tickFire',elapsedMs:3000}});
 assert.equal(s.flashes.length,8);assert.equal(s.battle.hits.length,33);near(s.battle.cumulative.raw,33*4.98);
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'reset'}});const before=s;
 s=S.comboSessionReducer(s,{type:'act',action:{kind:'tickFire',elapsedMs:4000}});assert.equal(s,before);assert.deepEqual(plain(s.flashes),[]);
});

function fakeClock(){let time=0,id=0;const jobs=new Map();return {jobs,now:()=>time,schedule:(fn,delay)=>{const key=++id;jobs.set(key,{fn,at:time+delay});return key;},cancel:key=>jobs.delete(key),elapse:ms=>{time+=ms;},run:()=>{const entry=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(entry&&entry[1].at<=time){jobs.delete(entry[0]);entry[1].fn();}}};}
function controlled(){const clock=fakeClock(),calls=[];const controller=new HoldFireController(clock,{start:()=>calls.push(['start']),tick:t=>calls.push(['tick',t]),stop:t=>calls.push(['stop',t])});return {clock,calls,controller};}
test('controller has one owner and one timer; repeated keydown and secondary pointer cannot duplicate or stop it',()=>{
 const {clock,calls,controller:c}=controlled();assert.equal(c.start('pointer:1',300,84),true);assert.equal(c.start('key: ',300,84),false);assert.equal(clock.jobs.size,1);
 clock.elapse(300);clock.run();assert.deepEqual(calls,[['start'],['tick',300]]);assert.equal(clock.jobs.size,1);
 assert.equal(c.stop('pointer:2'),false);assert.equal(c.active,true);clock.elapse(20);assert.equal(c.stop('pointer:1'),true);assert.equal(clock.jobs.size,0);assert.deepEqual(calls.at(-1),['stop',320]);assert.equal(c.stop(),false);
});
test('late timer reports actual elapsed time then schedules next absolute boundary',()=>{
 const {clock,calls,controller:c}=controlled();c.start('key: ',300,84);clock.elapse(1000);clock.run();assert.deepEqual(calls.at(-1),['tick',1000]);assert.equal([...clock.jobs.values()][0].at,1056);
 clock.elapse(56);clock.run();assert.deepEqual(calls.at(-1),['tick',1056]);assert.equal(clock.jobs.size,1);c.cancel();
});
test('cancelled callback cannot affect a later hold generation',()=>{
 const {clock,calls,controller:c}=controlled();c.start('a',300,84);const old=[...clock.jobs.values()][0].fn;c.cancel();c.start('b',300,84);old();assert.deepEqual(calls,[['start'],['start']]);assert.equal(clock.jobs.size,1);c.cancel();
});
test('controller can be cancelled synchronously by the simulation on death or exhaustion',()=>{
 const clock=fakeClock();let c;let ticks=0;c=new HoldFireController(clock,{start(){},tick(){ticks++;c.cancel();},stop(){}});c.start('a',300,84);clock.elapse(300);clock.run();assert.equal(ticks,1);assert.equal(clock.jobs.size,0);assert.equal(c.active,false);
});
test('safety bindings stop on release, pointercancel, blur, pagehide and hidden document; dispose removes listeners',()=>{
 const {clock,calls,controller:c}=controlled(),win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';const dispose=bindHoldSafety(c,win,doc);
 const pointer=(type,id)=>{const e=new Event(type);Object.defineProperty(e,'pointerId',{value:id});win.dispatchEvent(e);};
 for(const type of ['pointerup','pointercancel']){c.start('pointer:1',300,84);pointer(type,2);assert.equal(c.active,true);pointer(type,1);assert.equal(c.active,false);}
 for(const type of ['blur','pagehide']){c.start('key: ',300,84);win.dispatchEvent(new Event(type));assert.equal(c.active,false);}
 c.start('key: ',300,84);doc.dispatchEvent(new Event('visibilitychange'));assert.equal(c.active,true);doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(c.active,false);
 c.start('key: ',300,84);const count=calls.length;dispose();assert.equal(clock.jobs.size,0);assert.equal(c.active,false);assert.equal(calls.length,count);
 c.start('new',300,84);win.dispatchEvent(new Event('blur'));assert.equal(c.active,true);c.cancel();
});
test('integrated clock stop catches up once and no callback fires after release',()=>{
 const clock=fakeClock();let state=make();const c=new HoldFireController(clock,{start:()=>{state=act(state,'startFire');},tick:t=>{state=act(state,'tickFire',{elapsedMs:t});},stop:t=>{state=act(state,'stopFire',{elapsedMs:t});}});
 c.start('pointer:1',300,84);clock.elapse(1000);c.stop('pointer:1');assert.equal(state.hits.length,9);clock.elapse(5000);clock.run();assert.equal(state.hits.length,9);assert.equal(state.firing,null);assert.equal(clock.jobs.size,0);
});
