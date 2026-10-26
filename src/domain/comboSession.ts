import { createCombo, defaultComboScenario, selectComboItem, transitionCombo, type ComboAction, type ComboBuild, type ComboScenario, type ComboState } from './comboCombat';

export interface ComboSession { draft: ComboScenario; battle: ComboState | null; dirty: boolean; notice: string; flash: { key: number; damage: number } | null }
export type SessionAction =
  | { type: 'build'; side: 'attacker' | 'defender'; patch: Partial<ComboBuild> }
  | { type: 'item'; side: 'attacker' | 'defender'; id: string }
  | { type: 'conditions'; patch: Partial<Omit<ComboScenario, 'attacker' | 'defender' | 'defense'>> }
  | { type: 'defense'; patch: Partial<ComboScenario['defense']> }
  | { type: 'start' }
  | { type: 'act'; action: ComboAction };
export function initialComboSession(): ComboSession {
  return { draft: defaultComboScenario(), battle: null, dirty: true, notice: '自分・相手の条件を設定して、試算を開始してください。', flash: null };
}
export function comboSessionReducer(s: ComboSession, action: SessionAction): ComboSession {
  const edited = (draft: ComboScenario): ComboSession => ({ ...s, draft, dirty: true, flash: null, notice: '編集中です。「この条件で開始」でHP・時間をリセットして適用します。' });
  if (action.type === 'build') return edited({ ...s.draft, [action.side]: { ...s.draft[action.side], ...action.patch } });
  if (action.type === 'conditions') return edited({ ...s.draft, ...action.patch });
  if (action.type === 'defense') return edited({ ...s.draft, defense: { ...s.draft.defense, ...action.patch } });
  if (action.type === 'item') {
    const selected = selectComboItem(s.draft[action.side], action.id);
    if (selected.reason) return { ...s, notice: selected.reason };
    return edited({ ...s.draft, [action.side]: selected.build });
  }
  if (action.type === 'start') {
    const result = createCombo(s.draft);
    return result.state ? { ...s, battle: result.state, dirty: false, flash: null, notice: '開始しました。時間は操作ごとに進みます。' } : { ...s, notice: result.issues.join(' '), flash: null };
  }
  if (!s.battle || s.dirty) return { ...s, notice: '先に現在の条件で試算を開始してください。' };
  const result = transitionCombo(s.battle, action.action);
  if (!result.accepted) return { ...s, notice: result.reason!, flash: null };
  const delta = result.state.cumulative.health + result.state.cumulative.shield - s.battle.cumulative.health - s.battle.cumulative.shield;
  return { ...s, battle: result.state, flash: action.action.kind !== 'reset' && delta > 0 ? { key: result.state.sequence, damage: delta } : null,
    notice: action.action.kind === 'reset' ? 'HP・時間・クールダウン・弾数をリセットしました。' : action.action.kind === 'bomb' ? '爆弾を付着しました。3.5秒後に爆発します。' : result.state.health === 0 ? '相手のHPが0になりました。もう一度試すにはリセットしてください。' : `試算時刻 ${(result.state.timeMs/1000).toFixed(2)}秒。今回のHP・シールド減少 ${delta.toFixed(2)}、残HP ${result.state.health.toFixed(2)}。` };
}
