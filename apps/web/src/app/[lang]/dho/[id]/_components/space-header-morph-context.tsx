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

/** Fallback when `--app-menu-top-h` is unset */
export const SPACE_MENU_TOP_FALLBACK_PX = 65;

export type SpaceHeaderMorphContextValue = {
  /** 0 = hero fully visible below fold concept; 1 = hero eaten / compact state */
  progress: number;
  reducedMotion: boolean;
  /** True when below-banner actions row scrolls under MenuTop (+ optional subnav) — drives compact bar visibility */
  compactBarActive: boolean;
  setCompactBarActive: (active: boolean) => void;
};

const SpaceHeaderMorphContext = createContext<SpaceHeaderMorphContextValue>({
  progress: 0,
  reducedMotion: false,
  compactBarActive: false,
  setCompactBarActive: () => {},
});

export function useSpaceHeaderMorph() {
  return useContext(SpaceHeaderMorphContext);
}

type ProviderProps = {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
};

function parseCssPx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function SpaceHeaderMorphProvider({
  children,
  containerRef,
}: ProviderProps) {
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compactBarActive, setCompactBarActiveState] = useState(false);
  const frameRef = useRef<number>(0);

  const setCompactBarActive = useCallback((active: boolean) => {
    setCompactBarActiveState((p) => (p === active ? p : active));
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
    const menuTopVar = parseCssPx(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--app-menu-top-h',
      ),
    );
    const subNavVar = parseCssPx(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--app-subnav-h',
      ),
    );
    const menuLine =
      (menuTopVar || SPACE_MENU_TOP_FALLBACK_PX) + (subNavVar || 0);
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

  /** Breadcrumbs moved into the hero; no sticky subnav row — keep var defined for compact bar / morph math */
  useEffect(() => {
    document.documentElement.style.setProperty('--app-subnav-h', '0px');
    return () => {
      document.documentElement.style.removeProperty('--app-subnav-h');
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        updateProgress();
      });
    };

    const root = containerRef.current;
    let ro: ResizeObserver | undefined;
    if (root && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onScroll);
      ro.observe(root);
    }

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [containerRef, updateProgress]);

  const value = useMemo(
    () => ({
      progress,
      reducedMotion,
      compactBarActive,
      setCompactBarActive,
    }),
    [progress, reducedMotion, compactBarActive, setCompactBarActive],
  );

  return (
    <SpaceHeaderMorphContext.Provider value={value}>
      {children}
    </SpaceHeaderMorphContext.Provider>
  );
}
