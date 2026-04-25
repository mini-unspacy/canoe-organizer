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
  const triggerExit = useCallback((after: () => void, delay = 320) => {
    clearTimeout(timerRef.current);
    clearTimeout(exitTimerRef.current);
    setAnimationPhase('exit');
    setAnimationKey(k => k + 1);
    exitTimerRef.current = setTimeout(() => {
      after();
      setAnimationPhase(null);
      setAnimationKey(0);
    }, delay);
  }, []);

  return { animationKey, animationPhase, trigger, triggerExit } as const;
}
