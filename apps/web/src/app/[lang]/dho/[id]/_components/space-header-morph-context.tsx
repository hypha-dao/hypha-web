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

/** Fallback — sync with MenuTop actual height via --app-menu-top-h */
export const SPACE_MENU_TOP_FALLBACK_PX = 65;

export type SpaceHeaderMorphContextValue = {
  /** 0 = hero fully visible below fold concept; 1 = hero eaten / compact state */
  progress: number;
  reducedMotion: boolean;
  /** True while the in-flow action row sits under MenuTop + identity strip (portal duplicate hidden). */
  compactActionsAbsorbed: boolean;
  setCompactActionsAbsorbed: (absorbed: boolean) => void;
  /** Measured height of Join + action buttons row for sticky padding */
  actionsRowHeightPx: number;
  setActionsRowHeightPx: (px: number) => void;
};

const SpaceHeaderMorphContext = createContext<SpaceHeaderMorphContextValue>({
  progress: 0,
  reducedMotion: false,
  compactActionsAbsorbed: false,
  setCompactActionsAbsorbed: () => {},
  actionsRowHeightPx: 0,
  setActionsRowHeightPx: () => {},
});

export function useSpaceHeaderMorph() {
  return useContext(SpaceHeaderMorphContext);
}

type ProviderProps = {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Drives scroll progress for hero clip + avatar motion + compact chrome.
 */
export function SpaceHeaderMorphProvider({
  children,
  containerRef,
}: ProviderProps) {
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compactActionsAbsorbed, setCompactActionsAbsorbedState] =
    useState(false);
  const [actionsRowHeightPx, setActionsRowHeightPxState] = useState(0);
  const frameRef = useRef<number>(0);

  const setCompactActionsAbsorbed = useCallback((absorbed: boolean) => {
    setCompactActionsAbsorbedState((prev) =>
      prev === absorbed ? prev : absorbed,
    );
  }, []);

  const setActionsRowHeightPx = useCallback((px: number) => {
    setActionsRowHeightPxState((prev) =>
      Math.abs(prev - px) < 0.5 ? prev : px,
    );
  }, []);

  const updateProgress = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const hero = root.querySelector<HTMLElement>('[data-space-hero-card]');
    if (!hero) {
      setProgress(0);
      return;
    }

    const rect = hero.getBoundingClientRect();
    const menuTopVar = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--app-menu-top-h',
      ),
    );
    const menuLine = Number.isFinite(menuTopVar)
      ? menuTopVar
      : SPACE_MENU_TOP_FALLBACK_PX;
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
    () => ({
      progress,
      reducedMotion,
      compactActionsAbsorbed,
      setCompactActionsAbsorbed,
      actionsRowHeightPx,
      setActionsRowHeightPx,
    }),
    [
      progress,
      reducedMotion,
      compactActionsAbsorbed,
      setCompactActionsAbsorbed,
      actionsRowHeightPx,
      setActionsRowHeightPx,
    ],
  );

  return (
    <SpaceHeaderMorphContext.Provider value={value}>
      {children}
    </SpaceHeaderMorphContext.Provider>
  );
}
