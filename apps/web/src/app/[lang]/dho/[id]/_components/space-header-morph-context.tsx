'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Align with MenuTop `min-h-[65px]` */
export const SPACE_MENU_TOP_PX = 65;

export type SpaceHeaderMorphContextValue = {
  /** 0 = hero fully visible below fold concept; 1 = hero eaten / compact state */
  progress: number;
  reducedMotion: boolean;
};

const SpaceHeaderMorphContext = createContext<SpaceHeaderMorphContextValue>({
  progress: 0,
  reducedMotion: false,
});

export function useSpaceHeaderMorph() {
  return useContext(SpaceHeaderMorphContext);
}

type ProviderProps = {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Drives scroll progress for hero clip + avatar motion + compact bar morph.
 */
export function SpaceHeaderMorphProvider({
  children,
  containerRef,
}: ProviderProps) {
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const hero = root.querySelector<HTMLElement>('[data-space-hero-card]');
    if (!hero) {
      setProgress(0);
      return;
    }

    const rect = hero.getBoundingClientRect();
    const menuLine = SPACE_MENU_TOP_PX;
    /* Eat starts when hero top crosses menu line; completes over ~hero height overlap */
    const span = Math.max(rect.height + 48, 200);
    const raw = (menuLine - rect.top) / span;
    const p = Math.min(1, Math.max(0, raw));
    setProgress(p);
  }, [containerRef]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onMq = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        updateProgress();
      });
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [updateProgress]);

  const value = useMemo(
    () => ({ progress, reducedMotion }),
    [progress, reducedMotion],
  );

  return (
    <SpaceHeaderMorphContext.Provider value={value}>
      {children}
    </SpaceHeaderMorphContext.Provider>
  );
}
