import { useState, useCallback, useRef } from "react";

export function useAnimationTrigger(duration = 1500) {
  const [animationKey, setAnimationKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = useCallback(() => {
    clearTimeout(timerRef.current);
    setAnimationKey(k => k + 1);
    timerRef.current = setTimeout(() => setAnimationKey(0), duration);
  }, [duration]);

  return { animationKey, trigger } as const;
}
