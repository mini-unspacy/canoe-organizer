import { useState, useCallback, useRef } from "react";

export type AnimationPhase = 'enter' | 'exit' | null;
export type AnimationStyle = 'bounce' | 'drop' | 'slide' | 'flip' | 'fade';
export type AnimationStagger = 'forward' | 'reverse' | 'random';

const STYLES: AnimationStyle[] = ['bounce', 'drop', 'slide', 'flip', 'fade'];
const STAGGERS: AnimationStagger[] = ['forward', 'reverse', 'random'];
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// One-shot animation trigger used to choreograph "paddlers populate the
// boat" (Auto) and "paddlers leave the boat" (Clear). Each call picks a
// fresh style + stagger order so the boat fills/empties differently every
// time. Components watch `animationKey` for changes and read style/phase
// to pick the right keyframes. `triggerExit` plays the exit animation
// FIRST and invokes the caller's mutation after `delay` ms — so the chips
// have time to fade out while still mounted before the data update
// unmounts them.
export function useAnimationTrigger(duration = 1500) {
  const [animationKey, setAnimationKey] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>(null);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('bounce');
  const [animationStagger, setAnimationStagger] = useState<AnimationStagger>('forward');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimerRef.current);
    setAnimationStyle(pick(STYLES));
    setAnimationStagger(pick(STAGGERS));
    setAnimationPhase('enter');
    setAnimationKey(k => k + 1);
    timerRef.current = setTimeout(() => {
      setAnimationKey(0);
      setAnimationPhase(null);
    }, duration);
  }, [duration]);

  // Plays the exit animation, then calls `after()` once `delay` ms have
  // elapsed (which should be ≥ animation length). Lets the caller mutate
  // state AFTER chips have visually faded so the unmount feels intentional
  // rather than abrupt.
  //
  // Phase + key are NOT reset alongside `after()` — that would re-render
  // the (still mounted, mutation hasn't propagated yet) chips with no
  // animation phase, snapping them back to full opacity for one frame
  // before they unmount. We instead leave phase='exit' until well after
  // the mutation has propagated and the chips have unmounted; by then
  // the reset is a no-op visually.
  const triggerExit = useCallback((after: () => void, delay = 620) => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimerRef.current);
    setAnimationStyle(pick(STYLES));
    setAnimationStagger(pick(STAGGERS));
    setAnimationPhase('exit');
    setAnimationKey(k => k + 1);
    exitTimerRef.current = setTimeout(after, delay);
    timerRef.current = setTimeout(() => {
      setAnimationKey(0);
      setAnimationPhase(null);
    }, delay + 1500);
  }, []);

  return {
    animationKey,
    animationPhase,
    animationStyle,
    animationStagger,
    trigger,
    triggerExit,
  } as const;
}
