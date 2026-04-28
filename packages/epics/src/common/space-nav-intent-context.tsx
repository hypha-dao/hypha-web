'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

/** After manual space nav, suppress AI suggestion chips briefly (“quiet AI”). */
const MANUAL_NAV_COOLDOWN_MS = 30_000;

type SpaceNavIntentContextValue = {
  /** Call when the user navigates via the left space menu (not AI). */
  noteManualNavigation: () => void;
  /** True if the user clicked a menu link recently; used to keep AI suggestions subdued. */
  isManualCooldownActive: () => boolean;
};

const SpaceNavIntentContext = createContext<SpaceNavIntentContextValue | null>(
  null,
);

export function SpaceNavIntentProvider({ children }: { children: ReactNode }) {
  const lastManualNavAtRef = useRef(0);

  const noteManualNavigation = useCallback(() => {
    lastManualNavAtRef.current = Date.now();
  }, []);

  const isManualCooldownActive = useCallback(() => {
    return Date.now() - lastManualNavAtRef.current < MANUAL_NAV_COOLDOWN_MS;
  }, []);

  const value = useMemo(
    () => ({ noteManualNavigation, isManualCooldownActive }),
    [noteManualNavigation, isManualCooldownActive],
  );

  return (
    <SpaceNavIntentContext.Provider value={value}>
      {children}
    </SpaceNavIntentContext.Provider>
  );
}

export function useSpaceNavIntent(): SpaceNavIntentContextValue | null {
  return useContext(SpaceNavIntentContext);
}
