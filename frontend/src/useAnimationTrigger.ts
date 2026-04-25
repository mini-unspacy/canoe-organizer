import { useState, useCallback, useRef } from "react";

export type AnimationPhase = 'enter' | 'exit' | null;

// One-shot animation trigger used to choreograph "paddlers populate the
// boat" (Auto) and "paddlers leave the boat" (Clear). Components watch
// `animationKey` for changes and `animationPhase` to decide which keyframe
// run. `triggerExit` runs the exit animation FIRST, then invokes the
// caller's mutation after `delay` ms — so the chips have time to fade out
// while still mounted before the data update unmounts them.
export function useAnimationTrigger(duration = 1500) {
  const [animationKey, setAnimationKey] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimerRef.current);
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
  const triggerExit = useCallback((after: () => void, delay = 320) => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimerRef.current);
    setAnimationPhase('exit');
    setAnimationKey(k => k + 1);
    exitTimerRef.current = setTimeout(after, delay);
    timerRef.current = setTimeout(() => {
      setAnimationKey(0);
      setAnimationPhase(null);
    }, delay + 1500);
  }, []);

  return { animationKey, animationPhase, trigger, triggerExit } as const;
}
