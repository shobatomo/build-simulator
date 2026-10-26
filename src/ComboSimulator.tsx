"use client";
import Link from 'next/link';
import {useEffect,useMemo,useReducer,useRef,useState,type Dispatch} from 'react';
import {COMBO_RULES as R} from './domain/bebopComboRules';
import {assembleComboBuild,resolveComboScenario,type Ability,type ComboBuild,type ComboDamageType,type ComboHit} from './domain/comboCombat';
import {comboSessionReducer,initialComboSession,type ComboSession,type SessionAction} from './domain/comboSession';
import {ACTION_ICONS,ITEM_ICONS,RESIST_ICONS,SHIELD_ICON} from './comboIcons';
import {useHeldFire} from './useHeldFire';

const abilities: Array<{key:Ability;name:string;type:ComboDamageType}> = [
  {key:'uppercut',name:'Uppercut',type:'melee'},{key:'bomb',name:'Sticky Bomb',type:'spirit'},
  {key:'hook',name:'Grapple Arm',type:'melee'},{key:'beam',name:'Hyper Beam',type:'spirit'},
];
const damageNames: Record<ComboDamageType,string>={bullet:'弾丸',spirit:'スピリット',melee:'近接'};
const format=(n:number,digits=2)=>n.toLocaleString('ja-JP',{minimumFractionDigits:digits,maximumFractionDigits:digits});
function Icon({src,className=''}:{src:string;className?:string}){return <img className={'combo-icon '+className} src={src} alt="" aria-hidden="true" draggable={false} width="48" height="48"/>;}
function NumberField({label,value,onChange,min=0,max=1e7,step='any',hint,placeholder,icon,compact=false}:{label:string;value:number|null;onChange:(n:number|null)=>void;min?:number;max?:number;step?:string;hint?:string;placeholder?:string;icon?:string;compact?:boolean}){
  return <label className="combo-field"><span>{icon&&<Icon src={icon}/>}<span className={compact?'combo-sr-only':''}>{label}</span>{compact&&<span aria-hidden="true">%</span>}</span>
    <input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={value!==null&&Number.isFinite(value)?value:''} placeholder={placeholder} onChange={e=>onChange(e.target.value.trim()===''||!Number.isFinite(e.target.valueAsNumber)?null:e.target.valueAsNumber)}/>
    {hint&&<small>{hint}</small>}</label>;
}
function BuildEditor({side,build,dispatch}:{side:'attacker'|'defender';build:ComboBuild;dispatch:Dispatch<SessionAction>}){
  const heading=side==='attacker'?'自分 · 攻撃側':'相手 · 防御側';
  const stats=assembleComboBuild(build).stats;
  const patch=(patch:Partial<ComboBuild>)=>dispatch({type:'build',side,patch});
  return <section className="combo-editor" aria-label={heading+'のビルド'}>
    <div className="combo-section-heading"><h2>{heading}</h2><span className="combo-badge">Bebop</span></div>
    <div className="combo-two-fields"><label className="combo-field"><span className="combo-sr-only">{heading+'のヒーロー'}</span><select aria-label={heading+'のヒーロー'} value={build.heroId} onChange={e=>patch({heroId:e.target.value})}><option value="15">Bebop</option><option disabled>他ヒーローは未対応</option></select></label><NumberField label={heading+'のブーン'} value={build.level} min={1} max={36} step="1" onChange={n=>patch({level:n??NaN})}/></div>
    <fieldset><legend>アイテム <span>{build.itemIds.length}/12</span></legend><div className="combo-item-icons">
      {R.items.map(item=><button key={item.id} type="button" className="combo-icon-tile" aria-label={item.name+(build.itemIds.includes(item.id)?'を解除':'を選択')} aria-pressed={build.itemIds.includes(item.id)} onClick={()=>dispatch({type:'item',side,id:item.id})}><Icon src={ITEM_ICONS[item.id]}/><span className="combo-tooltip" role="tooltip">{item.name}</span>{build.itemIds.includes(item.id)&&<b className="combo-check" aria-hidden="true">✓</b>}</button>)}
    </div></fieldset>
    <details className="combo-details"><summary>5品の詳細</summary><div className="combo-item-reference">{R.items.map(item=><div key={item.id}><Icon src={ITEM_ICONS[item.id]}/><p><b>{item.name}</b><small>{item.cost.toLocaleString()} souls · {item.health?'HP +'+item.health+' ':''}{item.spirit?'Spirit +'+item.spirit+' ':''}{item.bullet!==null?'弾丸耐性30%・低HP最終値は要入力':''}{item.spiritResist!==null?'スピリット耐性30%・低HP最終値は要入力':''}</small></p></div>)}</div><p className="combo-help">アイテム強化なし。上位選択で構成元を置換。上位所持中の下位追加は拒否します。</p></details>
    {side==='attacker'&&<fieldset><legend>能力の強化</legend><div className="combo-stage-icons">{abilities.map((a,i)=><label className="combo-field" key={a.key} title={a.name}><span><Icon src={ACTION_ICONS[a.key]}/><span className="combo-sr-only">{a.name}</span><b aria-hidden="true">{i+1}</b></span><select aria-label={a.name+' 強化段階'} value={build.stages[a.key]} onChange={e=>patch({stages:{...build.stages,[a.key]:Number(e.target.value)}})}>{[0,1,2,3].map(n=><option value={n} key={n}>{n===0?'0':String(n)}</option>)}</select></label>)}</div><p className="combo-help">0＝未強化でも使用可。解放ポイントは省略。</p></fieldset>}
    <details className="combo-details"><summary>カテゴリ加算（任意）</summary><label className="combo-field"><span>購入カテゴリボーナス</span><select value={build.purchaseMode} onChange={e=>patch({purchaseMode:e.target.value as ComboBuild['purchaseMode']})}><option value="excluded">除外する検証条件</option><option value="resolved">確認済み加算値を入力</option></select></label><p className="combo-help">cost_bonusesの適用式は未確認。価格から推測しません。除外時は実ゲームの完全なビルド値ではありません。</p>{build.purchaseMode==='resolved'&&<div className="combo-three-fields">{(['health','spirit','shot'] as const).map((key,i)=><NumberField key={key} label={['HP追加','Spirit追加','1発ダメージ追加'][i]} value={build.purchase[key]} onChange={n=>patch({purchase:{...build.purchase,[key]:n}})}/>)}</div>}</details>
    {stats&&<dl className="combo-mini-stats" aria-label={heading+'の計算ステータス'}><div><dt>HP</dt><dd>{format(stats.maxHealth)}</dd></div><div><dt>Spirit</dt><dd>{format(stats.spirit)}</dd></div><div><dt>射撃</dt><dd>{format(stats.shot,3)}</dd></div><div><dt>近接</dt><dd>{format(stats.lightMelee)}</dd></div></dl>}
  </section>;
}
function DefenseEditor({session,dispatch}:{session:ComboSession;dispatch:Dispatch<SessionAction>}){
  const defense=session.draft.defense,stats=assembleComboBuild(session.draft.defender).stats;
  return <section className="combo-editor" aria-label="防御と計算条件">
    <h2>耐性・条件</h2><div className="combo-resistance-fields">{(['bullet','spirit','melee'] as const).map(type=>{
      const sources=type==='bullet'?stats?.bulletSources:type==='spirit'?stats?.spiritSources:null;
      const auto=sources&&sources.length<=1?String(sources[0]??0)+'%':'要入力';
      return <NumberField key={type} label={damageNames[type]+' 最終耐性 (%)'} icon={RESIST_ICONS[type]} compact value={defense.finalResistance[type]} min={-100} max={100} placeholder={type==='melee'?'必須':'自動 '+auto} hint={type==='melee'?'近接・別指定':damageNames[type]+' '+auto} onChange={n=>dispatch({type:'defense',patch:{finalResistance:{...defense.finalResistance,[type]:n}}})}/>;
    })}</div><p className="combo-help">空欄＝単独効果。複数の合成と低HP時は最終値を入力。基礎耐性0%は検証条件です。</p>
    {(['bullet','spirit'] as const).filter(type=>stats?.thresholds[type]!=null).map(type=><div className="combo-required" key={type}><strong><Icon src={RESIST_ICONS[type]}/> HP50%未満</strong><NumberField label={'HP50%未満の'+damageNames[type]+'最終耐性 (%)'} value={defense.belowResistance[type]} min={-100} max={100} placeholder="確認済みの最終値" onChange={n=>dispatch({type:'defense',patch:{belowResistance:{...defense.belowResistance,[type]:n}}})}/><small>追加15%の合成式は未検証。未入力なら開始不可。</small></div>)}
    <div className="combo-two-fields"><NumberField label="相手の開始HP (%)" value={defense.startHealthPercent} min={.1} max={100} onChange={n=>dispatch({type:'defense',patch:{startHealthPercent:n}})}/><NumberField label="ビーム照射 (秒)" icon={ACTION_ICONS.beam} value={session.draft.beamSeconds} min={.1} max={11} step=".1" onChange={n=>dispatch({type:'conditions',patch:{beamSeconds:n}})}/><NumberField label="爆弾ボーナス (%)" icon={ACTION_ICONS.bomb} value={session.draft.bombBonusPercent} max={1000} hint="入力値で固定・スタック増加なし" onChange={n=>dispatch({type:'conditions',patch:{bombBonusPercent:n}})}/><NumberField label="フック追加飛翔 (秒)" icon={ACTION_ICONS.hook} value={session.draft.hookTravelSeconds} max={5} onChange={n=>dispatch({type:'conditions',patch:{hookTravelSeconds:n}})}/></div>
    <details className="combo-details"><summary><Icon src={SHIELD_ICON}/> シールド</summary><div className="combo-resistance-fields">{(['bullet','spirit','melee'] as const).map(type=><NumberField key={type} label={damageNames[type]+'シールド'} icon={RESIST_ICONS[type]} value={defense.shields[type]} onChange={n=>dispatch({type:'defense',patch:{shields:{...defense.shields,[type]:n}}})}/>)}</div><p className="combo-help">耐性後に属性別のシールド→HPの順。共有・貫通は未再現。</p></details>
  </section>;
}
function HitRow({hit}:{hit:ComboHit}){
  const name=hit.attack==='shot'?'射撃':abilities.find(a=>a.key===hit.attack)?.name;
  return <details className="combo-hit"><summary><span>{format(hit.atMs/1000)}s · {name}<small>{damageNames[hit.type]}{hit.belowThreshold?' · 低HP耐性':''}</small></span><strong>{format(hit.afterResistance)}</strong></summary><div className="combo-hit-detail"><p>{hit.formula}</p><p>{format(hit.raw,3)} × (1 − {format(hit.resistance)}%) = {format(hit.afterResistance,3)}</p><p>シールド −{format(hit.shieldDamage)} ／ HP −{format(hit.healthDamage)} ／ 超過 {format(hit.overkill)}</p><p>残HP {format(hit.healthAfter)}</p></div></details>;
}
export default function ComboSimulator(){
  const [session,dispatch]=useReducer(comboSessionReducer,undefined,initialComboSession);
  const [editor,setEditor]=useState<'attacker'|'defender'|'conditions'>('attacker');
  const configRef=useRef<HTMLElement>(null),arenaRef=useRef<HTMLElement>(null);
  const resolution=useMemo(()=>resolveComboScenario(session.draft),[session.draft]);
  const battle=session.battle,activeScenario=battle?.scenario;
  const held=useHeldFire(battle,session.dirty,dispatch);
  const jump=(target:HTMLElement|null)=>{held.stop();target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});};
  useEffect(()=>{if(activeScenario){arenaRef.current?.focus({preventScroll:true});arenaRef.current?.scrollIntoView({block:'start'});}},[activeScenario]);
  const disabled=!battle||session.dirty||battle.health<=0;
  const firing=!!battle?.firing;
  const shownHealth=battle?.health??(resolution.resolved?resolution.resolved.defender.maxHealth*session.draft.defense.startHealthPercent!/100:null);
  const maxHealth=battle?.resolved.defender.maxHealth??resolution.resolved?.defender.maxHealth??null;
  const last=battle?.hits.at(-1);
  const act=(kind:Ability|'shot'|'reload'|'reset')=>{held.stop();dispatch({type:'act',action:{kind}});};
  return <div className="combo-page" lang="ja">
    <header className="combo-header"><Link href="/">← ビルダー</Link><span>DEADLOCK <b>COMBO LAB</b></span><a href="#combo-assumptions">前提・範囲</a></header>
    <main className="combo-main"><div className="combo-title"><p className="combo-eyebrow">BEBOP · 6819</p><h1>コンボ試算 <span className="combo-badge">試験版</span></h1></div>
      <section className="combo-scope" aria-label="試験版の対応範囲">
        <p><b>Bebop同士・5品限定</b> ／ ゲーム内実測は未検証</p><p>カテゴリ加算は初期値で除外・爆弾スタック固定。未確定耐性は手入力必須。</p>
        <details id="combo-assumptions"><summary>対応範囲・計算の前提</summary><ul>
          <li>既存ビルダーの選択は自動で引き継ぎません。Extra Health、Extra Spirit、Improved Spirit、Bullet Resilience、Spirit Resilienceのみ。</li>
          <li>固定版6819の近似モデル。成長は加算、近距離の胴体命中。カテゴリ購入ボーナスを除外した初期条件は完全な実ゲームビルドではありません。</li>
          <li>Resilience低HP・複数耐性の合成は最終値の入力が必要。近接耐性は別指定（初期0%）。貫通、追加増幅、頭部命中、回復、CC、移動、他ヒーローは未対応。</li>
          <li>Uppercutは主対象への近接のみで着地AoEを足しません。Grappleも近接で、強化増幅は弾丸のみ。近接への武器バフ変換は未再現。</li>
          <li>爆弾は入力ボーナス固定で3.5秒後。新規スタック増加なし。ビームは指定時間を一括計算し0.1秒末尾の直撃のみ。近接AoEは重ねません。</li>
          <li>射撃だけ長押し中に実時間を進めます。初期準備0.3秒、間隔0.084秒。離すと停止し、次の長押しは再準備します。ゲーム内の厳密な時刻・丸め・シールド順は未検証。</li>
        </ul><p><a href="https://api.deadlock-api.com/v1/assets/items/by-hero-id/15?client_version=6819" target="_blank" rel="noreferrer">コミュニティAssets API</a> · ゲームビルド {R.buildTimestamp}。公式APIではありません。配色はユーザー指定です。</p></details>
      </section>
      <div className="combo-layout"><section className="combo-config" ref={configRef} tabIndex={-1} aria-label="ビルドと条件">
        <nav className="combo-editor-tabs" aria-label="編集する対象">{(['attacker','defender','conditions'] as const).map((key,i)=><button key={key} type="button" aria-pressed={editor===key} onClick={()=>{held.stop();setEditor(key);}}>{['自分','相手','防御・条件'][i]}</button>)}</nav>
        {session.dirty&&<p className="combo-edit-feedback">{session.notice}</p>}
        {editor==='conditions'?<DefenseEditor session={session} dispatch={dispatch}/>:<BuildEditor key={editor} side={editor} build={session.draft[editor]} dispatch={dispatch}/>}
        {resolution.issues.length>0&&<div className="combo-issues" role="status"><strong>入力が必要です</strong><ul>{resolution.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>{editor!=='conditions'&&<button type="button" onClick={()=>setEditor('conditions')}>防御・条件を開く</button>}</div>}
        <button type="button" className="combo-start" disabled={resolution.issues.length>0} onClick={()=>{held.stop();dispatch({type:'start'});}}>{session.dirty&&battle?'変更を反映・リセット':'この条件で開始'}</button>
      </section>
      <section className="combo-arena-panel" aria-label="コンボ試算" ref={arenaRef} tabIndex={-1}>
        <div className="combo-arena"><div className="combo-arena-top"><span>{session.dirty&&battle?'編集中':firing?'連続射撃':battle?'試算中':'開始前'}</span><span>TIME <b>{format((battle?.timeMs??0)/1000)}s</b></span></div>
          <div className="combo-target"><img src={R.hero.image} alt="相手のBebop" width="160" height="200"/><div className="combo-target-caption"><span>DEFENDER</span><strong>Bebop</strong><div className="combo-target-items">{(battle?.scenario.defender.itemIds??session.draft.defender.itemIds).map(id=><span key={id} title={R.items.find(i=>i.id===id)?.name}><Icon src={ITEM_ICONS[id]}/><span className="combo-sr-only">{R.items.find(i=>i.id===id)?.name}</span></span>)}</div></div>
            <div className="combo-damage-layer" aria-hidden="true">{session.flashes.map(flash=><span key={flash.key} className={'combo-damage-number damage-'+flash.type+' lane-'+((Number(flash.key.match(/\d+/)?.[0])||0)%3)}>{flash.type==='melee'&&<Icon src={RESIST_ICONS.melee}/>}−{format(flash.damage)}</span>)}</div>
          </div>
          <div className="combo-health"><div><span>HP</span><strong>{shownHealth===null?'未確定':format(shownHealth)} <small>/ {maxHealth===null?'—':format(maxHealth)}</small></strong></div><progress aria-label="相手の残HP" value={shownHealth??0} max={maxHealth??1}/></div>
          <div className="combo-arena-meta"><span aria-label={'弾数 '+(battle?.ammo??R.weapon.ammo)+'/'+R.weapon.ammo}><Icon src={ACTION_ICONS.shot}/>{battle?.ammo??R.weapon.ammo}/{R.weapon.ammo}</span><span aria-label={'待機中の爆弾 '+(battle?.pending.filter(p=>p.attack==='bomb').length??0)}><Icon src={ACTION_ICONS.bomb}/>{battle?.pending.filter(p=>p.attack==='bomb').length??0}</span>{battle?.weaponBuffUntil&&battle.weaponBuffUntil>battle.timeMs?<span>射撃↑ {format((battle.weaponBuffUntil-battle.timeMs)/1000,1)}s</span>:null}{battle?.hookAmpUntil&&battle.hookAmpUntil>battle.timeMs?<span>弾丸↑ {format((battle.hookAmpUntil-battle.timeMs)/1000,1)}s</span>:null}</div>
        </div>
        <div className="combo-gun-controls"><button type="button" className="combo-hold-fire" aria-label="通常射撃（長押し）" aria-pressed={firing} disabled={disabled||battle?.ammo===0} {...held.handlers}><Icon src={ACTION_ICONS.shot}/><span>{firing?'射撃中 · 離すと停止':'長押しで射撃'}<small>{firing&&battle?.firing?.shots===0?'準備中…':'マウス・タッチ・Space / Enter'}</small></span></button><button type="button" aria-label="通常射撃を1発（単発確認）" title="単発確認" disabled={disabled||firing||battle?.ammo===0} onClick={()=>act('shot')}><Icon src={ACTION_ICONS.shot}/><b aria-hidden="true">1</b></button></div>
        <div className="combo-ability-actions">{abilities.map((a,i)=>{
          const cooldown=Math.max(0,((battle?.readyAt[a.key]??0)-(battle?.timeMs??0))/1000);
          return <button key={a.key} type="button" className={'combo-icon-tile ability-'+a.type} aria-label={a.name+'（'+damageNames[a.type]+'）'} disabled={disabled||firing||cooldown>0} onClick={()=>act(a.key)}><Icon src={ACTION_ICONS[a.key]}/><b className="combo-action-number" aria-hidden="true">{i+1}</b><span className="combo-tooltip" role="tooltip">{a.name} · {damageNames[a.type]}{cooldown>0?' · '+format(cooldown,1)+'s':''}</span>{cooldown>0&&<span className="combo-cooldown" aria-hidden="true">{format(cooldown,1)}</span>}<span className="combo-damage-kind" aria-hidden="true">{a.type==='melee'?<Icon src={RESIST_ICONS.melee}/>:<span>◆</span>}</span></button>;
        })}</div>
        <div className="combo-time-actions">{[.1,1,5].map(seconds=><button type="button" key={seconds} disabled={!battle||session.dirty||firing} onClick={()=>dispatch({type:'act',action:{kind:'wait',seconds}})} aria-label={seconds+'秒進める'}>+{seconds}s</button>)}<button type="button" disabled={disabled||firing} onClick={()=>act('reload')} aria-label="リロード" title="リロード">⟳</button><button type="button" disabled={!battle||session.dirty} onClick={()=>act('reset')} aria-label="リセット" title="リセット">↺</button></div>
        <p className="combo-notice" role="status" aria-live={firing?'off':'polite'}>{session.notice}</p>
        <dl className="combo-totals"><div><dt>防御前 · 累積</dt><dd>{battle?format(battle.cumulative.raw):'—'}</dd></div><div><dt>防御後 · 累積</dt><dd>{battle?format(battle.cumulative.afterResistance):'—'}</dd></div><div><dt>HP減少</dt><dd>{battle?format(battle.cumulative.health):'—'}</dd></div><div><dt><Icon src={SHIELD_ICON}/>シールド消費</dt><dd>{battle?format(battle.cumulative.shield):'—'}</dd></div></dl>
        {last&&<div className="combo-latest"><span>直近の1命中 · {damageNames[last.type]}</span><b>{format(last.raw,3)} → {format(last.afterResistance,3)}</b><small>耐性 {format(last.resistance)}% · HP −{format(last.healthDamage)} · 超過 {format(last.overkill)}</small></div>}
        <details className="combo-details combo-history"><summary>命中ログ・計算式（{battle?.hits.length??0}件）</summary><p className="combo-help">表示だけ丸めます。直近200件、累積は全命中。長押しの表示数は最大8個で、全命中はこのログに記録します。</p>{battle?.hits.length?[...battle.hits].reverse().map(hit=><HitRow key={hit.id} hit={hit}/>):<p>まだ命中していません。</p>}</details>
      </section></div>
    </main>
    <nav className="combo-mobile-nav" aria-label="設定と試算の移動"><button type="button" onClick={()=>jump(configRef.current)}>ビルド・条件{session.dirty&&battle?' · 編集中':''}</button><button type="button" onClick={()=>jump(arenaRef.current)}>コンボ試算{battle?' · HP '+format(battle.health,0):''}</button></nav>
  </div>;
}