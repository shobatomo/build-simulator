'use client';
import type {ComboScenario,Ability,ComboDamageType} from './domain/comboCombat';
import {COMBO_RULES as R} from './domain/bebopComboRules';

function Numeric({label,value,onChange,min=0,max=100000,step='any',hint}:{label:string;value:number|null;onChange:(value:number|null)=>void;min?:number;max?:number;step?:string;hint?:string}){
 return <label>{label}<input type="number" inputMode="decimal" min={min} max={max} step={step} value={value??''} onChange={e=>onChange(e.currentTarget.value===''?null:e.currentTarget.valueAsNumber)}/>{hint&&<small>{hint}</small>}</label>;
}
export default function TrialSettings({scenario:s,onChange}:{scenario:ComboScenario;onChange:(value:ComboScenario)=>void}){
 const stage=(ability:Ability,n:number)=>onChange({...s,attacker:{...s.attacker,stages:{...s.attacker.stages,[ability]:n}}});
 const defense=(field:'finalResistance'|'shields',type:ComboDamageType,n:number|null)=>onChange({...s,defense:{...s.defense,[field]:{...s.defense[field],[type]:n}}});
 return <details className="trial-settings"><summary>試算条件・対応範囲</summary>
  <p>未編集の相手はInfernus・ブーン1・アイテムなし。基礎耐性0%・シールド0・カテゴリ購入ボーナス除外の簡易モデルです。自分／相手の編集内容は独立して保持されます。</p>
  <p>対応品：{R.items.map(i=>i.name).join(' / ')}。低HP耐性や複数耐性の合成を推測しません。未確認欄は空欄のままにすると試算を拒否します。</p>
  <div className="trial-settings-grid">{(['uppercut','bomb','hook','beam'] as Ability[]).map(ability=><label key={ability}>{ability} 強化段階<select value={s.attacker.stages[ability]} onChange={e=>stage(ability,Number(e.target.value))}>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}
   <Numeric label="爆弾の保存済みボーナス (%)" value={s.bombBonusPercent} max={1000} onChange={n=>onChange({...s,bombBonusPercent:n})}/>
   <Numeric label="相手の開始HP (%)" value={s.defense.startHealthPercent} min={.1} max={100} onChange={n=>onChange({...s,defense:{...s.defense,startHealthPercent:n}})}/>
   {(['bullet','spirit','melee'] as ComboDamageType[]).map(type=><Numeric key={type} label={`相手 ${type} 最終耐性 (%)`} value={s.defense.finalResistance[type]} min={-100} max={100} hint={type==='melee'?'明示値が必要':'空欄＝単一耐性のみ自動。複数なら拒否'} onChange={n=>defense('finalResistance',type,n)}/>)}
   {(['bullet','spirit'] as const).map(type=><Numeric key={'low-'+type} label={`相手 ${type} 低HP最終耐性 (%)`} value={s.defense.belowResistance[type]} min={-100} max={100} hint="該当アイテムを選択したときは必須" onChange={n=>onChange({...s,defense:{...s.defense,belowResistance:{...s.defense.belowResistance,[type]:n}}})}/>)}
   {(['bullet','spirit','melee'] as ComboDamageType[]).map(type=><Numeric key={'shield-'+type} label={`相手 ${type} シールド`} value={s.defense.shields[type]} onChange={n=>defense('shields',type,n)}/>)}
  </div><p>能力は即時・全持続命中。期限付き増幅、回復、爆弾スタック獲得は未再現。ゲーム内実測は未検証。モーダルのリセットはHP・弾薬を戻し、編集したビルドは初期化しません。</p>
 </details>;
}
