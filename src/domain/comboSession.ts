import { createCombo, defaultComboScenario, selectComboItem, transitionCombo, type ComboAction, type ComboBuild, type ComboScenario, type ComboState, type ComboDamageType } from './comboCombat';

export interface DamageFlash { key: string; damage: number; type: ComboDamageType }
export interface ComboSession { draft: ComboScenario; battle: ComboState | null; dirty: boolean; notice: string; flashes: DamageFlash[] }
export type SessionAction =
  | { type: 'build'; side: 'attacker' | 'defender'; patch: Partial<ComboBuild> }
  | { type: 'item'; side: 'attacker' | 'defender'; id: string }
  | { type: 'conditions'; patch: Partial<Omit<ComboScenario, 'attacker' | 'defender' | 'defense'>> }
  | { type: 'defense'; patch: Partial<ComboScenario['defense']> }
  | { type: 'start' }
  | { type: 'act'; action: ComboAction };
export function initialComboSession(): ComboSession {
  return { draft: defaultComboScenario(), battle: null, dirty: true, notice: '条件を選んで開始してください。', flashes: [] };
}
export function comboSessionReducer(s: ComboSession, action: SessionAction): ComboSession {
  const edited = (draft: ComboScenario): ComboSession => ({ ...s, draft, battle: s.battle?.firing ? {...s.battle,firing:null,gunSpun:false} : s.battle, dirty: true, flashes: [], notice: '編集中・開始ボタンで反映します。' });
  if (action.type === 'build') return edited({ ...s.draft, [action.side]: { ...s.draft[action.side], ...action.patch } });
  if (action.type === 'conditions') return edited({ ...s.draft, ...action.patch });
  if (action.type === 'defense') return edited({ ...s.draft, defense: { ...s.draft.defense, ...action.patch } });
  if (action.type === 'item') {
    const selected = selectComboItem(s.draft[action.side], action.id);
    return selected.reason ? { ...s, notice: selected.reason } : edited({ ...s.draft, [action.side]: selected.build });
  }
  if (action.type === 'start') {
    const result = createCombo(s.draft);
    return result.state ? { ...s, battle: result.state, dirty: false, flashes: [], notice: '開始しました。射撃は長押し。' } : { ...s, notice: result.issues.join(' '), flashes: [] };
  }
  if (!s.battle || s.dirty) return { ...s, notice: '先に現在の条件で開始してください。' };
  const result = transitionCombo(s.battle, action.action);
  if (!result.accepted) return { ...s, notice: result.reason! };
  if (result.state===s.battle) return s;
  const hits = result.state.hits.filter(hit=>hit.id>s.battle!.sequence);
  let next: DamageFlash[];
  if (action.action.kind==='tickFire' || action.action.kind==='stopFire') {
    next = hits.map(hit=>({key:'hit-'+hit.id,damage:hit.healthDamage+hit.shieldDamage,type:hit.type}));
  } else {
    const totals = new Map<ComboDamageType,number>();
    for (const hit of hits) totals.set(hit.type,(totals.get(hit.type)??0)+hit.healthDamage+hit.shieldDamage);
    next = [...totals].map(([type,damage])=>({key:'action-'+result.state.sequence+'-'+type,type,damage}));
  }
  const state = result.state;
  const notice = action.action.kind==='reset' ? 'HP・時間・弾数をリセットしました。'
    : state.health<=0 ? '標的のHPが0です。リセットしてください。'
    : state.ammo===0 ? '弾切れです。リロードしてください。'
    : state.firing ? '射撃中 · '+state.firing.shots+'発 · 離すと停止'
    : action.action.kind==='bomb' ? '爆弾を付着・3.5秒後に爆発。'
    : '時刻 '+(state.timeMs/1000).toFixed(2)+'秒 · 残HP '+state.health.toFixed(2);
  return {...s,battle:state,flashes:action.action.kind==='reset'?[]:[...s.flashes,...next].slice(-8),notice};
}
