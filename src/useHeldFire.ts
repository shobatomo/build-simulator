'use client';
import {useEffect, useLayoutEffect, useRef, type Dispatch, type KeyboardEvent, type PointerEvent, type MouseEvent} from 'react';
import {HoldFireController, bindHoldSafety} from './domain/holdFireController';
import {nextComboShotAt, type ComboState} from './domain/comboCombat';
import {COMBO_RULES} from './domain/bebopComboRules';
import type {SessionAction} from './domain/comboSession';

export function useHeldFire(battle: ComboState | null, dirty: boolean, dispatch: Dispatch<SessionAction>) {
  const latest = useRef({battle,dirty});
  useLayoutEffect(()=>{latest.current={battle,dirty};},[battle,dirty]);
  const controllerRef = useRef<HoldFireController | null>(null);
  if (!controllerRef.current) controllerRef.current = new HoldFireController({
    now:()=>performance.now(), schedule:(callback,delay)=>window.setTimeout(callback,delay), cancel:handle=>window.clearTimeout(handle as number),
  },{
    start:()=>dispatch({type:'act',action:{kind:'startFire'}}),
    tick:elapsedMs=>dispatch({type:'act',action:{kind:'tickFire',elapsedMs}}),
    stop:elapsedMs=>dispatch({type:'act',action:{kind:'stopFire',elapsedMs}}),
  });
  const controller = controllerRef.current;
  useEffect(()=>bindHoldSafety(controller,window,document),[controller]);
  useLayoutEffect(()=>{ if (dirty || !battle?.firing) controller.cancel(); },[controller,dirty,battle?.firing]);
  const start = (owner: string)=>{
    const {battle:b,dirty:d}=latest.current;
    if (!b || d || b.health<=0 || b.ammo<=0) return;
    controller.start(owner,nextComboShotAt(b)-b.timeMs,Math.round(COMBO_RULES.weapon.cycle*1000));
  };
  return {
    stop:()=>controller.stop(),
    handlers:{
      onPointerDown:(e: PointerEvent<HTMLButtonElement>)=>{
        if (e.button!==0 || !e.isPrimary) return;
        e.preventDefault(); e.currentTarget.focus({preventScroll:true});
        start(`pointer:${e.pointerId}`);
        if (controller.active) e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerUp:(e: PointerEvent<HTMLButtonElement>)=>controller.stop(`pointer:${e.pointerId}`),
      onPointerCancel:(e: PointerEvent<HTMLButtonElement>)=>controller.stop(`pointer:${e.pointerId}`),
      onLostPointerCapture:(e: PointerEvent<HTMLButtonElement>)=>controller.stop(`pointer:${e.pointerId}`),
      onBlur:()=>controller.stop(),
      onContextMenu:(e: MouseEvent<HTMLButtonElement>)=>e.preventDefault(),
      onKeyDown:(e: KeyboardEvent<HTMLButtonElement>)=>{
        if (e.key!==' ' && e.key!=='Enter') return;
        e.preventDefault(); if (!e.repeat) start(`key:${e.key}`);
      },
      onKeyUp:(e: KeyboardEvent<HTMLButtonElement>)=>{
        if (e.key!==' ' && e.key!=='Enter') return;
        e.preventDefault(); controller.stop(`key:${e.key}`);
      },
      // Assistive-technology activation has no pointer/key hold lifecycle.
      onClick:(e: MouseEvent<HTMLButtonElement>)=>{
        if (e.detail===0 && !controller.active && !latest.current.dirty) dispatch({type:'act',action:{kind:'shot'}});
      },
    },
  };
}
