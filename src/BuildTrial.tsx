'use client';
import {useCallback,useReducer} from 'react';
import {COMBO_RULES as R} from './domain/bebopComboRules';
import {prepareBuilderTrial,type BuilderTrialSnapshot} from './domain/builderTrial';
import {createInstantTrial,instantTrialNotes,transitionInstantTrial,type InstantTrialState} from './domain/instantTrial';
import type {Ability,ComboAction} from './domain/comboCombat';
import type {SessionAction} from './domain/comboSession';
import {useHeldFire} from './useHeldFire';
import {ACTION_ICONS,ITEM_ICONS,RESIST_ICONS} from './comboIcons';
import './buildTrial.css';

const actions:Array<{key:Ability;label:string;type:'melee'|'spirit'}>=[{key:'uppercut',label:'Uppercut',type:'melee'},{key:'bomb',label:'Sticky Bomb',type:'spirit'},{key:'hook',label:'Grapple Arm',type:'melee'},{key:'beam',label:'Hyper Beam',type:'spirit'}];
const fmt=(n:number)=>n.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2});
function init(snapshot:BuilderTrialSnapshot){const prepared=prepareBuilderTrial(snapshot);const result=prepared.scenario?createInstantTrial(prepared.scenario):null;return {state:result?.state??null,issues:[...prepared.issues,...(result?.issues??[]).map(message=>({code:'invalid-conditions',message}))],notes:prepared.scenario?instantTrialNotes(prepared.scenario):[]};}
type Model=ReturnType<typeof init>;
function reduce(current:Model,action:ComboAction):Model{return current.state?{...current,state:transitionInstantTrial(current.state,action)}:current;}
function Icon({src}:{src:string}){return <img src={src} alt="" aria-hidden="true" draggable={false} width={40} height={40}/>;}
export default function BuildTrial({snapshot}:{snapshot:BuilderTrialSnapshot}){
  const [{state,issues,notes},dispatch]=useReducer(reduce,snapshot,init);
  const forward=useCallback((action:SessionAction)=>{if(action.type==='act')dispatch(action.action);},[]);
  const held=useHeldFire(state?.battle??null,!state,forward);
  const battle=state?.battle,disabled=!battle||battle.health<=0, firing=!!battle?.firing;
  const act=(kind:Ability|'reset')=>{held.stop();dispatch({kind});};
  return <section className="build-trial" aria-label="選択ビルドの簡易試算">
    <div className="trial-selected"><strong>自分：{snapshot.hero?.name[snapshot.locale]??'未選択'}</strong><span>ブーン {snapshot.level}</span><div>{snapshot.selectedItems.map(selected=>{const item=snapshot.items.find(i=>i.id===selected.itemId);return <span key={selected.instanceId} title={item?.name[snapshot.locale]??selected.itemId}>{(item?.icon||ITEM_ICONS[selected.itemId])?<Icon src={item?.icon||ITEM_ICONS[selected.itemId]}/>:<span aria-hidden="true">?</span>}<span className="trial-sr-only">{item?.name[snapshot.locale]??selected.itemId}</span></span>;})}</div></div>
    <p className="trial-scope">版6819・攻撃Bebop／相手Infernus・Bebop／5品限定。能力は全命中、Beamは全11秒分を即時集計。ゲーム内実測は未検証。</p>
    {state&&<p className="trial-scope">爆弾スタック増加・回復・周囲へのAoEは未再現。{notes.filter(note=>note.includes('カテゴリ購入')||note.includes('期限付き')).join(' ')}</p>}
    {issues.length>0&&<div className="trial-blocked" role="status"><strong>この条件では試算できません</strong><ul>{issues.map((issue,i)=><li key={i}>{issue.message}</li>)}</ul><p>選択は変更していません。閉じてビルドを調整できます。</p></div>}
    {state&&<><p className="trial-target-label">相手：{state.battle.resolved.defender.name} · ブーン {state.battle.scenario.defender.level} · HP {fmt(state.battle.resolved.defender.maxHealth)}</p>
      <div className="trial-target"><img src={state.battle.resolved.defender.image} alt={'相手の'+state.battle.resolved.defender.name} width={130} height={165}/><div className="trial-damage" aria-hidden="true">{state.flashes.map(f=><span key={f.id} className={'trial-number trial-'+f.type+' lane-'+f.id%3}>{f.type==='melee'&&<Icon src={RESIST_ICONS.melee}/>}−{fmt(f.damage)}</span>)}</div>
        <div className="trial-health"><span>残HP</span><strong>{fmt(state.battle.health)}</strong><progress aria-label="相手の残HP" value={state.battle.health} max={state.battle.resolved.defender.maxHealth}/></div>
      </div></>}
    <div className="trial-controls"><button type="button" className="trial-shoot" aria-label="通常射撃（長押し）" aria-pressed={firing} disabled={disabled||battle?.ammo===0} {...held.handlers}><Icon src={ACTION_ICONS.shot}/><span>{firing?'離すと停止':'長押しで射撃'}<small>{battle?`${battle.ammo}/${R.weapon.ammo}`:'—'} · Space / Enter</small></span></button>
      <div className="trial-abilities">{actions.map((a,i)=><button type="button" key={a.key} className={'trial-ability trial-'+a.type} aria-label={a.label+(a.key==='beam'?'（全11秒・即時集計）':'（即時命中）')} title={a.label} disabled={disabled||firing} onClick={()=>act(a.key)}><Icon src={ACTION_ICONS[a.key]}/><span aria-hidden="true">{i+1}</span><small className="trial-tooltip">{a.label}</small></button>)}</div>
      <button type="button" className="trial-reset" aria-label="試算をリセット" disabled={!battle} onClick={()=>act('reset')}>↺ リセット</button>
    </div>
    {state&&<><p role="status" aria-live={firing?'off':'polite'} className="trial-notice">{state.notice}</p><Receipt state={state}/><details className="trial-detail"><summary>条件・計算の前提</summary><ul>{notes.map(note=><li key={note}>{note}</li>)}</ul><p>能力段階 {Object.values(state.battle.scenario.attacker.stages).join(' / ')} · 爆弾ボーナス {state.battle.scenario.bombBonusPercent}%固定</p><p>弾切れはリセットで回復。射撃以外で時計は進めません。</p><p>初期耐性：弾丸 {state.battle.resolved.resistance.bullet}% / スピリット {state.battle.resolved.resistance.spirit}% / 近接 {state.battle.resolved.resistance.melee}%</p></details></>}
  </section>;
}
function Receipt({state}:{state:InstantTrialState}){const r=state.receipt;return <div className="trial-result" aria-label="試算結果">
  <dl><div><dt>今回・防御前合計</dt><dd>{r?fmt(r.rawTotal):'—'}</dd></div><div><dt>今回・全命中想定（防御後）</dt><dd>{r?fmt(r.projectedTotal):'—'}</dd></div><div><dt>実際のHP減少</dt><dd>{r?fmt(r.hpLost):'—'}</dd></div><div><dt>シールド消費 / 超過</dt><dd>{r?fmt(r.shieldLost)+' / '+fmt(r.overkill):'—'}</dd></div></dl>
  {r&&<small>{r.assumption}</small>}<p>累積 HP減少 {fmt(state.total.hp)} · 防御後合計 {fmt(state.total.projected)}</p>
  </div>;}
