import {COMBO_RULES as R} from './bebopComboRules';
import {createCombo,transitionCombo,type Ability,type ComboAction,type ComboDamageType,type ComboScenario,type ComboState} from './comboCombat';

export const INSTANT_TRIAL_MODEL='bebop-instant-6819-v1';
export interface TrialReceipt {
  id:number; attack:'shot'|Ability; type:ComboDamageType;
  rawTotal:number; projectedTotal:number; hpLost:number; shieldLost:number; overkill:number;
  packets:number; assumption:string;
}
export interface TrialFlash {id:number;type:ComboDamageType;damage:number}
export interface InstantTrialState {
  model:typeof INSTANT_TRIAL_MODEL; battle:ComboState; receipt:TrialReceipt|null;
  flashes:TrialFlash[]; sequence:number;
  total:{raw:number;projected:number;hp:number;shield:number;overkill:number};
  notice:string;
}
const empty=()=>({raw:0,projected:0,hp:0,shield:0,overkill:0});
export function createInstantTrial(scenario:ComboScenario):{state:InstantTrialState|null;issues:string[]} {
  const result=createCombo(scenario);
  return {issues:result.issues,state:result.state?{model:INSTANT_TRIAL_MODEL,battle:result.state,receipt:null,flashes:[],sequence:0,total:empty(),notice:'全命中の簡易試算。射撃は長押し。'}:null};
}
export function instantTrialNotes(scenario:ComboScenario):string[] {
  const notes=[`版 ${R.clientVersion}・攻撃Bebop／防御Infernus・Bebop／5品限定・ゲーム内実測は未検証。`,
    '能力は待ち時間・クールダウンなし。Beamは全11秒分の直撃を即時集計します。',
    '能力の数字は全命中想定の防御後合計です。実際のHP減少とは別に表示します。',
    'HP0以降の仮想命中も合計へ含め、その時点の低HP耐性条件を使います。',
    '爆弾の獲得スタック・回復・近接AoEは再現しません。'];
  if(scenario.attacker.purchaseMode==='excluded'||scenario.defender.purchaseMode==='excluded')notes.push('カテゴリ購入ボーナスを除外する指定条件です。');
  if(scenario.attacker.stages.uppercut>=2)notes.push('Uppercutの期限付き射撃強化はこのモードでは未再現です。');
  if(scenario.attacker.stages.hook>=1)notes.push('Grapple Armの期限付き弾丸増幅はこのモードでは未再現です。');
  return notes;
}
export function transitionInstantTrial(current:InstantTrialState,action:ComboAction):InstantTrialState {
  if(action.kind==='reset')return createInstantTrial(current.battle.scenario).state!;
  if(action.kind==='wait'||action.kind==='reload')return {...current,notice:'時間送り・リロードはこのモードでは使用しません。弾切れ時はリセットしてください。'};
  if(['shot','startFire','tickFire','stopFire'].includes(action.kind)){
    const result=transitionCombo(current.battle,action);
    if(!result.accepted)return {...current,notice:result.reason!};
    if(result.state===current.battle)return current;
    const hits=result.state.hits.filter(h=>h.id>current.battle.sequence);
    let seq=current.sequence;
    const flashes=hits.map(h=>({id:++seq,type:h.type,damage:h.healthDamage+h.shieldDamage}));
    // Each actual bullet counts; visual cadence cannot change receipt totals.
    const sum=(key:'raw'|'afterResistance'|'healthDamage'|'shieldDamage'|'overkill')=>hits.reduce((v,h)=>v+h[key],0);
    const receipt:TrialReceipt|null=hits.length?{id:seq,attack:'shot',type:'bullet',rawTotal:sum('raw'),projectedTotal:sum('afterResistance'),hpLost:sum('healthDamage'),shieldLost:sum('shieldDamage'),overkill:sum('overkill'),packets:hits.length,assumption:'射撃は命中ごとに計算'}:current.receipt;
    return {...current,battle:result.state,sequence:seq,receipt,flashes:[...current.flashes,...flashes].slice(-8),
      total:{raw:current.total.raw+sum('raw'),projected:current.total.projected+sum('afterResistance'),hp:current.total.hp+sum('healthDamage'),shield:current.total.shield+sum('shieldDamage'),overkill:current.total.overkill+sum('overkill')},
      notice:result.state.health<=0?'HP0・リセットで再開':result.state.ammo===0?'弾切れ・リセットで回復':result.state.firing?'長押し射撃中・離すと停止':'射撃停止'};
  }
  if(!['uppercut','bomb','hook','beam'].includes(action.kind))return {...current,notice:'未対応の操作です。'};
  if(current.battle.firing)return {...current,notice:'射撃を離してから能力を使用してください。'};
  if(current.battle.health<=0)return {...current,notice:'HP0・リセットで再開してください。'};
  const attack=action.kind as Ability;
  const b=current.battle, a=b.resolved.attacker, stage=b.scenario.attacker.stages;
  const type:ComboDamageType=attack==='uppercut'||attack==='hook'?'melee':'spirit';
  const packets=attack==='beam'?Math.round(R.beam.AbilityChannelTime/R.beam.Interval):1;
  const raw=attack==='uppercut'?a.lightMelee*R.uppercut.meleeScale
    :attack==='hook'?a.lightMelee*R.hook.meleeScale
    :attack==='bomb'?(R.bomb.Damage+(stage.bomb>=2?R.bomb.damageUpgrade:0)+R.bomb.spiritScale*a.spirit)*(1+b.scenario.bombBonusPercent!/100)
    :(R.beam.DPS+(stage.beam>=2?R.beam.damageUpgrade:0)+R.beam.spiritScale*a.spirit)*R.beam.Interval;
  const battle={...b,shields:{...b.shields},gunSpun:false};
  const total=empty();
  for(let i=0;i<packets;i++){
    const threshold=type==='melee'?null:b.resolved.defender.thresholds[type];
    const below=threshold!==null&&battle.health/b.resolved.defender.maxHealth*100<threshold;
    const resist=below&&type!=='melee'?b.resolved.belowResistance[type]:b.resolved.resistance[type];
    const damage=raw*(1-resist/100);
    const shield=Math.min(battle.shields[type],damage),hp=Math.min(battle.health,damage-shield);
    battle.shields[type]-=shield;battle.health-=hp;
    total.raw+=raw;total.projected+=damage;total.shield+=shield;total.hp+=hp;total.overkill+=damage-shield-hp;
  }
  const id=current.sequence+1;
  const receipt:TrialReceipt={id,attack,type,rawTotal:total.raw,projectedTotal:total.projected,hpLost:total.hp,shieldLost:total.shield,overkill:total.overkill,packets,
    assumption:attack==='beam'?'全11秒・110段の直撃を一括。近接AoEを加算しません。':attack==='bomb'?'入力済み永久ボーナス固定・即時爆発。':'主対象1人への命中。期限付き増幅は未再現。'};
  return {...current,battle,receipt,sequence:id,flashes:[{id,type,damage:receipt.projectedTotal}],
    total:{raw:current.total.raw+total.raw,projected:current.total.projected+total.projected,hp:current.total.hp+total.hp,shield:current.total.shield+total.shield,overkill:current.total.overkill+total.overkill},notice:battle.health<=0?'HP0・リセットで再開':'能力を即時適用しました。'};
}
