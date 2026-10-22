'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { Circle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import { APP_CHROME_ICON_TRIGGER } from '../../common/chrome-radius';

export const SPACES_RAIL_ID = 'member-spaces-rail';

type SpacesRailControlValue = {
  /** A collapsible rail is mounted on this page. */
  active: boolean;
  open: boolean;
  toggle: () => void;
  /** Call from the rail while it is mounted. Returns an unregister function. */
  register: () => () => void;
};

const SpacesRailControlContext = createContext<SpacesRailControlValue | null>(
  null,
);

const inactiveRail: SpacesRailControlValue = {
  active: false,
  open: false,
  toggle: () => {},
  register: () => () => {},
};

export function useSpacesRailControl() {
  return useContext(SpacesRailControlContext) ?? inactiveRail;
}

export function SpacesRailProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(0);
  const register = useCallback(() => {
    setMounted((count) => count + 1);
    return () => setMounted((count) => Math.max(0, count - 1));
  }, []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    if (mounted > 0) return;
    setOpen(false);
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const value = useMemo<SpacesRailControlValue>(
    () => ({
      active: mounted > 0,
      open: mounted > 0 && open,
      toggle,
      register,
    }),
    [mounted, open, register, toggle],
  );

  return (
    <SpacesRailControlContext.Provider value={value}>
      {children}
    </SpacesRailControlContext.Provider>
  );
}

function isHomePath(pathname: string) {
  return /\/(?:home|my-dashboard)\/?$/.test(pathname);
}

/**
 * Circle in the top bar, to the left of Hypha.
 * Mobile: every screen that has a spaces list. Desktop: Home only.
 */
export function SpacesRailTopToggle() {
  const { active, open, toggle } = useSpacesRailControl();
  const pathname = usePathname() ?? '';
  const t = useTranslations('MemberHome');
  if (!active) return null;
  return (
    <button
      type="button"
      className={cn(
        APP_CHROME_ICON_TRIGGER,
        !isHomePath(pathname) && 'xl:hidden',
      )}
      aria-label={t('spacesRail')}
      aria-expanded={open}
      aria-controls={SPACES_RAIL_ID}
      title={t('spacesRail')}
      onClick={toggle}
    >
      <Circle aria-hidden />
    </button>
  );
}
