import type {ItemSelectionState} from './itemSelection';
export type BuilderSide='attacker'|'defender';
export interface EditorBuild {heroId:string|undefined;level:number;selection:ItemSelectionState}
export type BuilderSides=Record<BuilderSide,EditorBuild>;
export function initialBuilderSides():BuilderSides {
  return {attacker:{heroId:undefined,level:1,selection:{items:[],notice:null}},defender:{heroId:'1',level:1,selection:{items:[],notice:null}}};
}
export function updateBuilderSide(sides:BuilderSides,side:BuilderSide,update:(current:EditorBuild)=>EditorBuild):BuilderSides {
  return {...sides,[side]:update(sides[side])};
}
