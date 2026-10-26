"use client";

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { COMBO_RULES as R } from './domain/bebopComboRules';
import { assembleComboBuild, resolveComboScenario, type Ability, type ComboAttack, type ComboBuild, type ComboDamageType, type ComboHit } from './domain/comboCombat';
import { comboSessionReducer, initialComboSession, type ComboSession, type SessionAction } from './domain/comboSession';

const attacks: Array<{ key: ComboAttack; number: string; name: string; detail: string }> = [
  { key: 'shot', number: '●', name: '通常射撃', detail: '1発・胴体命中' },
  { key: 'uppercut', number: '1', name: 'Uppercut', detail: '主対象への近接ダメージ' },
  { key: 'bomb', number: '2', name: 'Sticky Bomb', detail: '3.5秒後に爆発' },
  { key: 'hook', number: '3', name: 'Grapple Arm', detail: 'フック・軽近接×0.7' },
  { key: 'beam', number: '4', name: 'Hyper Beam', detail: '指定時間の直撃を計算' },
];
const damageNames: Record<ComboDamageType,string> = { bullet: '弾丸', spirit: 'スピリット', melee: '近接' };
const format = (n: number, digits = 2) => n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function NumberField({ label, value, onChange, min = 0, max = 1e7, step = 'any', hint, placeholder }: {
  label: string; value: number | null; onChange: (n: number | null) => void;
  min?: number; max?: number; step?: string; hint?: string; placeholder?: string;
}) {
  return <label className="combo-field"><span>{label}</span><input type="number" inputMode="decimal" min={min} max={max} step={step} value={value !== null && Number.isFinite(value) ? value : ''} placeholder={placeholder}
    onChange={e => onChange(e.target.value.trim() === '' || !Number.isFinite(e.target.valueAsNumber) ? null : e.target.valueAsNumber)} />{hint && <small>{hint}</small>}</label>;
}

function BuildEditor({ side, build, dispatch }: { side: 'attacker'|'defender'; build: ComboBuild; dispatch: Dispatch<SessionAction> }) {
  const heading = side === 'attacker' ? '自分 · 攻撃側' : '相手 · 防御側';
  const stats = assembleComboBuild(build).stats;
  const patch = (patch: Partial<ComboBuild>) => dispatch({ type: 'build', side, patch });
  return <section aria-label={`${heading}のビルド`} className="combo-editor">
    <div className="combo-section-heading"><div><p className="combo-eyebrow">{side === 'attacker' ? 'ATTACKER' : 'DEFENDER'}</p><h2>{heading}</h2></div><span className="combo-badge">Bebop対応</span></div>
    <div className="combo-two-fields"><label className="combo-field"><span>{heading}のヒーロー</span><select value={build.heroId} onChange={e=>patch({heroId:e.target.value})}><option value="15">Bebop</option><option disabled>他ヒーローは準備中</option></select></label>
      <NumberField label={`${heading}のブーン`} value={build.level} min={1} max={36} step="1" onChange={n=>patch({level:n ?? NaN})} /></div>
    <p className="combo-help">自分と相手、それぞれの試算用ビルドをここで設定します。</p>
    <fieldset><legend>アイテム <span>{build.itemIds.length}/12</span></legend><div className="combo-item-grid">
      {R.items.map(item=><button type="button" key={item.id} aria-pressed={build.itemIds.includes(item.id)} onClick={()=>dispatch({type:'item',side,id:item.id})}>
        <span>{build.itemIds.includes(item.id) ? '✓ ' : '+ '}{item.name}</span><small>{item.cost.toLocaleString()} souls{item.bullet !== null ? ' · 弾丸耐性30%' : item.spiritResist !== null ? ' · スピリット耐性30%' : [item.health ? `HP +${item.health}` : '',item.spirit ? `Spirit +${item.spirit}` : ''].filter(Boolean).map(x=>` · ${x}`).join('')}</small>
      </button>)}
    </div></fieldset>
    <p className="combo-help">対応は上記5品・アイテム強化なし。上位を選ぶと構成元を置換します。</p>
    {side === 'attacker' && <fieldset><legend>アビリティ強化段階</legend><div className="combo-stage-grid">
      {attacks.filter(a=>a.key!=='shot').map(a=><label className="combo-field" key={a.key}><span>{a.number}. {a.name}</span><select value={build.stages[a.key as Ability]} onChange={e=>patch({stages:{...build.stages,[a.key]:Number(e.target.value)}})}>{[0,1,2,3].map(n=><option key={n} value={n}>{n === 0 ? '未強化（使用可能）' : `強化 ${n}`}</option>)}</select></label>)}
    </div><p className="combo-help">解放・ポイント制約は省略。回復、移動、CC、近接への武器バフ変換は未再現。ダメージと対応する射撃バフ・フック再使用のみ試算します。</p></fieldset>}
    <details className="combo-details"><summary>購入カテゴリボーナスの扱い</summary><label className="combo-field"><span>計算方法</span><select value={build.purchaseMode} onChange={e=>patch({purchaseMode:e.target.value as ComboBuild['purchaseMode']})}><option value="excluded">含めない検証条件</option><option value="resolved">確認済みの加算値を入力</option></select></label>
      <p className="combo-help">cost_bonusesの単位・合成・売却履歴は未確定です。現所持品だけから推測しません。「含めない」は実ゲームの全ビルド値を表しません。</p>
      {build.purchaseMode === 'resolved' && <div className="combo-three-fields">{(['health','spirit','shot'] as const).map((key,i)=><NumberField key={key} label={['HP追加','Spirit追加','1発ダメージ追加'][i]} value={build.purchase[key]} onChange={n=>patch({purchase:{...build.purchase,[key]:n}})} />)}</div>}
    </details>
    {stats && <dl className="combo-mini-stats" aria-label={`${heading}の計算ステータス`}><div><dt>最大HP</dt><dd>{format(stats.maxHealth)}</dd></div><div><dt>Spirit</dt><dd>{format(stats.spirit)}</dd></div><div><dt>射撃1発</dt><dd>{format(stats.shot,3)}</dd></div><div><dt>軽近接</dt><dd>{format(stats.lightMelee)}</dd></div></dl>}
  </section>;
}

function DefenseEditor({ session, dispatch }: { session: ComboSession; dispatch: Dispatch<SessionAction> }) {
  const defense = session.draft.defense;
  const stats = assembleComboBuild(session.draft.defender).stats;
  return <section className="combo-editor" aria-label="防御と計算条件">
    <div className="combo-section-heading"><div><p className="combo-eyebrow">CONDITIONS</p><h2>防御と計算条件</h2></div></div>
    <p className="combo-help">耐性は命中直前のHPで判定します。弾丸と近接は別入力です。初期の基礎耐性0%は、この試算の明示的な仮定です。</p>
    <div className="combo-three-fields">{(['bullet','spirit','melee'] as const).map(type=>{
      const sources = type === 'bullet' ? stats?.bulletSources : type === 'spirit' ? stats?.spiritSources : null;
      const auto = sources && sources.length <= 1 ? `${sources[0] ?? 0}%` : '入力が必要';
      return <NumberField key={type} label={`${damageNames[type]} 最終耐性 (%)`} value={defense.finalResistance[type]} min={-100} max={100} placeholder={type==='melee'?'入力必須':`自動: ${auto}`} hint={type==='melee'?'Bullet Resilienceから近接耐性を推測しません。':`空欄時は単独の根拠だけ使用。現在 ${auto}。`} onChange={n=>dispatch({type:'defense',patch:{finalResistance:{...defense.finalResistance,[type]:n}}})} />;
    })}</div>
    {(['bullet','spirit'] as const).filter(type=>stats?.thresholds[type] != null).map(type=><div className="combo-required" key={type}><strong>{damageNames[type]} Resilience の低HP条件</strong><p>API: 通常30%／HP50%未満で追加15%。合成結果が45%か40.5%かは未確認です。</p><NumberField label={`HP50%未満の${damageNames[type]}最終耐性 (%)`} value={defense.belowResistance[type]} min={-100} max={100} placeholder="確認値を入力" onChange={n=>dispatch({type:'defense',patch:{belowResistance:{...defense.belowResistance,[type]:n}}})} /></div>)}
    <div className="combo-two-fields"><NumberField label="相手の開始HP (%)" value={defense.startHealthPercent} min={0.1} max={100} onChange={n=>dispatch({type:'defense',patch:{startHealthPercent:n}})} />
      <NumberField label="Hyper Beam 照射時間 (秒)" value={session.draft.beamSeconds} min={0.1} max={11} step="0.1" onChange={n=>dispatch({type:'conditions',patch:{beamSeconds:n}})} hint="準備1秒＋指定照射時間。0.1秒区間の末尾で積算する近似。" />
      <NumberField label="爆弾の永久ボーナス (%)" value={session.draft.bombBonusPercent} max={1000} onChange={n=>dispatch({type:'conditions',patch:{bombBonusPercent:n}})} hint="ゲームで確認した値。コンボ中は固定し、新規スタック獲得を再計算しません。" />
      <NumberField label="フックの追加飛翔時間 (秒)" value={session.draft.hookTravelSeconds} max={5} onChange={n=>dispatch({type:'conditions',patch:{hookTravelSeconds:n}})} hint="距離から推測しません。基準の準備0.1＋命中待ち0.5秒に加算。" />
    </div>
    <details className="combo-details"><summary>シールドを指定する</summary><p className="combo-help">各属性の入力シールドを耐性適用後に消費する仮定です。近接との共有・貫通・発動効果は未再現。</p><div className="combo-three-fields">{(['bullet','spirit','melee'] as const).map(type=><NumberField key={type} label={`${damageNames[type]}シールド`} value={defense.shields[type]} onChange={n=>dispatch({type:'defense',patch:{shields:{...defense.shields,[type]:n}}})} />)}</div></details>
  </section>;
}

function HitRow({ hit }: { hit: ComboHit }) {
  return <details className="combo-hit"><summary><span>{format(hit.atMs/1000)}s · {attacks.find(a=>a.key===hit.attack)?.name}<small>{damageNames[hit.type]}{hit.belowThreshold ? ' · 低HP耐性' : ''}</small></span><strong>{format(hit.afterResistance)}<small>防御後</small></strong></summary><div className="combo-hit-detail"><p>{hit.formula}</p><p><b>{format(hit.raw,3)}</b> × (1 − {format(hit.resistance)}%) = <b>{format(hit.afterResistance,3)}</b></p><p>シールド −{format(hit.shieldDamage)} ／ HP −{format(hit.healthDamage)} ／ 超過 {format(hit.overkill)}</p><p>残HP {format(hit.healthAfter)}</p></div></details>;
}

export default function ComboSimulator() {
  const [session, dispatch] = useReducer(comboSessionReducer, undefined, initialComboSession);
  const [editor, setEditor] = useState<'attacker'|'defender'|'conditions'>('attacker');
  const configRef = useRef<HTMLElement>(null);
  const arenaRef = useRef<HTMLElement>(null);
  const jump = (target: HTMLElement | null) => { target?.focus({preventScroll:true}); target?.scrollIntoView({block:'start'}); };
  const resolution = useMemo(()=>resolveComboScenario(session.draft),[session.draft]);
  const battle = session.battle;
  const activeScenario = battle?.scenario;
  useEffect(()=>{
    if (!activeScenario) return;
    const target = arenaRef.current;
    target?.focus({preventScroll:true});
    target?.scrollIntoView({block:'start'});
  },[activeScenario]);
  const disabled = !battle || session.dirty || battle.health<=0;
  const shownHealth = battle?.health ?? (resolution.resolved ? resolution.resolved.defender.maxHealth * session.draft.defense.startHealthPercent! / 100 : null);
  const maxHealth = battle?.resolved.defender.maxHealth ?? resolution.resolved?.defender.maxHealth ?? null;
  const last = battle?.hits.at(-1);
  return <div className="combo-page" lang="ja">
    <header className="combo-header"><Link href="/">← ビルダー</Link><span>DEADLOCK <b>COMBO LAB</b></span><a href="#combo-assumptions">前提と範囲</a></header>
    <main className="combo-main">
      <div className="combo-title"><p className="combo-eyebrow">BEBOP · VERSION {R.clientVersion}</p><h1>相手のビルドに、どう通る？</h1><p>自分と相手を設定して、射撃と4つの技を組み合わせる。HPを引き継ぐ、条件付きのダメージ試算。</p><span className="combo-model-label">コンボ試算（試験版） · ゲーム内実測は未検証</span></div>
      <section className="combo-scope" aria-labelledby="combo-scope-heading">
        <h2 id="combo-scope-heading">開始前に：この試験版の対応範囲</h2>
        <p>固定データ {R.clientVersion}・自分と相手はBebopのみ。対応5品：Extra Health、Extra Spirit、Improved Spirit、Bullet Resilience、Spirit Resilience。</p>
        <ul>
          <li>既存ビルダーとは別の設定です。ヒーロー・アイテムの選択を自動では引き継ぎません。</li>
          <li>購入カテゴリボーナスは初期設定で除外。全アイテムや実ゲームの完全なビルド値を計算するものではありません。</li>
          <li>Resilienceの低HP時耐性と、複数耐性の合成は最終値の手入力が必要です。未入力なら開始できません。近接耐性は別入力（初期値0%）です。</li>
          <li>爆弾の永久ボーナスは入力値を固定し、命中・キルによるスタック増加は再現しません。成長・命中時刻・シールド順などは近似で、ゲーム内実測との照合は未完了です。</li>
        </ul>
      </section>
      <div className="combo-layout">
        <section className="combo-config" ref={configRef} tabIndex={-1} aria-label="ビルドと条件">
          <nav className="combo-editor-tabs" aria-label="編集する対象">{(['attacker','defender','conditions'] as const).map((key,i)=><button key={key} type="button" aria-pressed={editor===key} onClick={()=>setEditor(key)}>{['自分のビルド','相手のビルド','防御・条件'][i]}</button>)}</nav>
          {session.dirty && <p className="combo-edit-feedback">{session.notice}</p>}
          {editor==='conditions' ? <DefenseEditor session={session} dispatch={dispatch}/> : <BuildEditor key={editor} side={editor} build={session.draft[editor]} dispatch={dispatch}/>}
          {resolution.issues.length>0 && <div className="combo-issues" role="status"><strong>確認が必要な条件</strong><ul>{resolution.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>{editor!=='conditions' && <button type="button" onClick={()=>setEditor('conditions')}>防御・条件を開く</button>}</div>}
          <button type="button" className="combo-start" disabled={resolution.issues.length>0} onClick={()=>dispatch({type:'start'})}>{session.dirty && battle ? '変更を適用してやり直す' : 'この条件で開始'}</button>
          <p className="combo-help">適用時にHP・時間をリセット。購入カテゴリボーナスは初期状態で含めません。</p>
        </section>
        <section className="combo-arena-panel" aria-label="コンボ試算" ref={arenaRef} tabIndex={-1}>
          <div className="combo-arena">
            <div className="combo-arena-top"><span>{session.dirty && battle ? '前の条件 · 編集中' : battle ? '進行中の条件' : '開始前'}</span><span>TIME <b>{format((battle?.timeMs??0)/1000)}s</b></span></div>
            <div className="combo-target"><img src={R.hero.image} alt="相手のBebop" width="160" height="200"/><div className="combo-target-caption"><span>DEFENDER</span><strong>Bebop</strong><small>{(battle?.scenario.defender.itemIds??session.draft.defender.itemIds).map(id=>R.items.find(i=>i.id===id)?.name).join(' · ') || 'アイテムなし'}</small></div>
              {session.flash && <div key={session.flash.key} className="combo-floating" aria-hidden="true">−{format(session.flash.damage)}<small>今回の操作で失ったHP＋シールド</small></div>}
            </div>
            <div className="combo-health"><div><span>残HP</span><strong>{shownHealth===null?'未確定':format(shownHealth)} <small>/ {maxHealth===null?'—':format(maxHealth)}</small></strong></div><progress aria-label="相手の残HP" value={shownHealth??0} max={maxHealth??1}/></div>
            <div className="combo-arena-meta"><span>弾数 {battle?.ammo??R.weapon.ammo}/{R.weapon.ammo}</span><span>爆弾待機 {battle?.pending.filter(p=>p.attack==='bomb').length??0}</span>{battle?.weaponBuffUntil && battle.weaponBuffUntil>battle.timeMs ? <span>射撃バフ 残{format((battle.weaponBuffUntil-battle.timeMs)/1000,1)}s</span>:null}{battle?.hookAmpUntil && battle.hookAmpUntil>battle.timeMs ? <span>弾丸増幅 残{format((battle.hookAmpUntil-battle.timeMs)/1000,1)}s</span>:null}</div>
          </div>
          <div className="combo-actions">{attacks.map(a=>{
            const cooldown = a.key==='shot'?0:Math.max(0,((battle?.readyAt[a.key]??0)-(battle?.timeMs??0))/1000);
            return <button key={a.key} type="button" disabled={disabled||cooldown>0||(a.key==='shot'&&battle?.ammo===0)} onClick={()=>dispatch({type:'act',action:{kind:a.key}})}><span className="combo-action-number">{a.number}</span><span><strong>{a.name}</strong><small>{cooldown>0?`再使用まで ${format(cooldown,1)}s`:a.detail}</small></span></button>;
          })}</div>
          <div className="combo-time-actions"><button type="button" disabled={!battle||session.dirty} onClick={()=>dispatch({type:'act',action:{kind:'wait',seconds:.1}})}>+0.1秒</button><button type="button" disabled={!battle||session.dirty} onClick={()=>dispatch({type:'act',action:{kind:'wait',seconds:1}})}>+1秒</button><button type="button" disabled={!battle||session.dirty} onClick={()=>dispatch({type:'act',action:{kind:'wait',seconds:5}})}>+5秒</button><button type="button" disabled={disabled} onClick={()=>dispatch({type:'act',action:{kind:'reload'}})}>リロード</button><button type="button" disabled={!battle||session.dirty} onClick={()=>dispatch({type:'act',action:{kind:'reset'}})}>リセット</button></div>
          <p className="combo-help">自動では時間が進みません。射撃・技・待機で進行し、ビームは指定照射時間までまとめて計算します。</p>
          <p className="combo-notice" role="status" aria-live="polite">{session.notice}</p>
          <dl className="combo-totals"><div><dt>累積 · 防御前</dt><dd>{battle?format(battle.cumulative.raw):'—'}</dd></div><div><dt>累積 · 防御後</dt><dd>{battle?format(battle.cumulative.afterResistance):'—'}</dd></div><div><dt>実際に減ったHP</dt><dd>{battle?format(battle.cumulative.health):'—'}</dd></div><div><dt>シールド消費</dt><dd>{battle?format(battle.cumulative.shield):'—'}</dd></div></dl>
          {last && <div className="combo-latest"><span>直近の1命中</span><b>{format(last.raw,3)} → {format(last.afterResistance,3)}</b><small>{damageNames[last.type]}耐性 {format(last.resistance)}% ／ HP −{format(last.healthDamage)} ／ 超過 {format(last.overkill)}</small></div>}
          <details className="combo-details combo-history" open={false}><summary>命中ごとの数値・式（直近{battle?.hits.length??0}件）</summary><p className="combo-help">小数は表示時のみ丸めます。直近200件を保持し、累積値は全命中を含みます。ビームは0.1秒ごとの行です。</p>{battle?.hits.length ? [...battle.hits].reverse().map(hit=><HitRow key={hit.id} hit={hit}/>):<p>まだ命中していません。</p>}</details>
        </section>
      </div>
      <section className="combo-assumptions" id="combo-assumptions"><p className="combo-eyebrow">SCOPE & EVIDENCE</p><h2>この数字が表す条件</h2>
        <ul><li>通常モード・Bebop同士、近距離、胴体に全命中する標的試験です。移動、射程減衰、パリィ、CC、自己爆弾、回復、DoTアイテム、他ヒーローは未対応。</li><li>基礎値・成長・5品の定数は固定版6819から取得。成長の加算、単独射撃バフの倍率、命中時刻、シールド順は明示した近似で、実ゲーム照合は未完了です。</li><li>Uppercutは主対象への軽近接のみ。着地範囲ダメージを投げた相手に足しません。フックは近接耐性を別入力し、増幅20%は弾丸だけに適用します。</li><li>爆弾ボーナスは入力した%を固定し、付着時の数値で3.5秒後に計算。命中・キル後の新規スタック、過去のSpirit変化は再現しません。</li><li>ビームは直撃だけを0.1秒区間の末尾で積算。近接範囲の75%を重ねません。同時刻は予約順に解決し、実ゲームのtick順・初回tickは未確認です。</li><li>耐性重複・低HP追加・近接への変換を推測しません。未確定欄は入力するまで開始できません。貫通・追加増幅・ヘッドショットは計算対象外です。</li></ul>
        <p>出典: <a href="https://api.deadlock-api.com/v1/assets/items/by-hero-id/15?client_version=6819" target="_blank" rel="noreferrer">コミュニティ解析Assets API · 6819</a> ／ <a href="https://forums.playdeadlock.com/threads/04-10-2026-update.125825/" target="_blank" rel="noreferrer">Valve変更履歴 · 2026-04-10</a>。ゲームビルド日時: {R.buildTimestamp}。この画面の計算ではDB・同期APIを使用しません。</p>
      </section>
    </main>
    <nav className="combo-mobile-nav" aria-label="設定と試算の移動"><button type="button" onClick={()=>jump(configRef.current)}>ビルド・条件{session.dirty && battle ? ' · 編集中' : ''}</button><button type="button" onClick={()=>jump(arenaRef.current)}>コンボ試算{battle ? ` · HP ${format(battle.health,0)}` : ''}</button></nav>
  </div>;
}
