import type {Hero,Item,Locale,SelectedItem} from '../types';
import {COMBO_RULES as R} from './bebopComboRules';
import {createCombo,defaultComboScenario,type ComboScenario} from './comboCombat';
import {DEFENDER_RULES} from './defenderRules';

export interface BuilderTrialInput {
  hero: Pick<Hero,'id'|'name'> | null;
  level: number;
  selectedItems: SelectedItem[];
  items: Item[];
  metadata: unknown;
  locale: Locale;
}
export interface TrialIssue {code:string; message:string}
export interface BuilderTrialSnapshot extends BuilderTrialInput { conditions: ComboScenario | null; opponent?:BuilderTrialInput }

export function defaultBuilderTrialScenario():ComboScenario {const scenario=defaultComboScenario();scenario.defender.heroId='1';return scenario;}

/** Capture selections, including disabled/enabled effect choices, without changing the builder. */
export function captureBuilderTrial(input:BuilderTrialInput,conditions:ComboScenario|null,opponent?:BuilderTrialInput):BuilderTrialSnapshot {
  const ids=new Set(input.selectedItems.map(i=>i.itemId));
  const opponentIds=new Set(opponent?.selectedItems.map(i=>i.itemId));
  return structuredCopy({...input,items:input.items.filter(i=>ids.has(i.id)),conditions,opponent:opponent?{...opponent,items:opponent.items.filter(i=>opponentIds.has(i.id))}:undefined});
}
function structuredCopy<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
function inspectBuilder(snapshot:BuilderTrialInput,side:'attacker'|'defender'):TrialIssue[] {
  const issues:TrialIssue[]=[];
  const fail=(code:string,message:string)=>issues.push({code,message});
  const metadata=snapshot.metadata&&typeof snapshot.metadata==='object'?snapshot.metadata as Record<string,unknown>:null;
  if(!metadata||metadata.clientVersion===undefined)fail('version-unknown','ビルダーのゲーム版を確認できないため試算できません。');
  else if(metadata.clientVersion!==R.clientVersion)fail('version-mismatch',`ビルダーのデータ版と試算モデル ${R.clientVersion} が一致しません。`);
  if(metadata?.clientVersion===R.clientVersion&&metadata.source!=='https://api.deadlock-api.com/v1/assets')fail('source-unverified','ゲームデータの取得元を確認できません。');
  const heroAllowed=side==='attacker'?snapshot.hero?.id===R.hero.id:!!DEFENDER_RULES[snapshot.hero?.id as keyof typeof DEFENDER_RULES];
  if(!heroAllowed)fail('unsupported-hero',`${snapshot.hero?.name[snapshot.locale]??'未選択'}：${side==='attacker'?'攻撃側はBebop':'防御側はInfernus/Bebop'}のみ対応しています。`);
  const ids=snapshot.selectedItems.map(i=>i.itemId);
  if(ids.length>12||new Set(ids).size!==ids.length)fail('invalid-selection','アイテムの重複または枠数が不正です。');
  for(const selected of snapshot.selectedItems){
    const definitions=snapshot.items.filter(i=>i.id===selected.itemId);
    const item=definitions.length===1?definitions[0]:null;
    const name=item?.name[snapshot.locale]??selected.itemId;
    const supported=R.items.find(i=>i.id===selected.itemId);
    if(!item){fail('missing-item',`${name}：選択したアイテム情報が欠落または重複しています。`);continue;}
    if(!supported)fail('unsupported-item',`${name}：効果が未対応のため試算できません。`);
    else if(item.className!==supported.className)fail('identity-mismatch',`${name}：IDと内部名の対応を確認できません。`);
    for(const id of selected.enabledEffectIds){
      const matches=item.effects.filter(e=>e.id===id);
      if(matches.length!==1)fail('unknown-effect',`${name}：有効にした効果 ${id} を特定できません。`);
      else if(matches[0].conditional)fail('unsupported-condition',`${name} / ${matches[0].name[snapshot.locale]}：有効な条件付き効果は未対応です。`);
    }
  }
  return issues.map(issue=>({...issue,message:`${side==='attacker'?'自分':'相手'}：${issue.message}`}));
}
export function prepareBuilderTrial(snapshot:BuilderTrialSnapshot):{scenario:ComboScenario|null;issues:TrialIssue[]} {
  const issues=[...inspectBuilder(snapshot,'attacker'),...(snapshot.opponent?inspectBuilder(snapshot.opponent,'defender'):[])];
  const fail=(code:string,message:string)=>issues.push({code,message});
  const ids=snapshot.selectedItems.map(i=>i.itemId);
  if(!snapshot.conditions)fail('conditions-pending','相手・能力の試算条件が未設定です。相手設定の導線は確認待ちです。');
  const prior=snapshot.conditions?.attacker;
  if(prior?.purchaseMode==='resolved'&&(prior.heroId!==snapshot.hero?.id||prior.level!==snapshot.level||
    [...prior.itemIds].sort().join(',')!==[...ids].sort().join(',')))
    fail('stale-purchase','自分のビルドが変わったため、確認済み購入ボーナスを再確認してください。');
  if(issues.length||!snapshot.conditions)return {scenario:null,issues};
  // The conditions provider supplies ability ranks, permanent bonus and explicit
  // purchase policy; none are guessed from the builder's display-only totals.
  const scenario=structuredCopy(snapshot.conditions);
  scenario.attacker={...scenario.attacker,heroId:snapshot.hero!.id,level:snapshot.level,itemIds:[...ids]};
  if(snapshot.opponent){
    const other=snapshot.opponent,otherIds=other.selectedItems.map(i=>i.itemId),prior=scenario.defender;
    if(prior.purchaseMode==='resolved'&&(prior.heroId!==other.hero?.id||prior.level!==other.level||[...prior.itemIds].sort().join(',')!==[...otherIds].sort().join(',')))
      fail('stale-purchase','相手のビルドが変わったため、確認済み購入ボーナスを再確認してください。');
    scenario.defender={...prior,heroId:other.hero!.id,level:other.level,itemIds:otherIds};
  }
  const validation=createCombo(scenario);
  for(const message of validation.issues)fail('invalid-conditions',message);
  return {scenario:issues.length?null:scenario,issues};
}
