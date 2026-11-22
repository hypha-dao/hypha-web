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
import { usePathname, useSearchParams } from 'next/navigation';
import { Circle, ChevronsUpDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { APP_CHROME_ICON_TRIGGER } from '../../common/chrome-radius';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { MySpacesSwitcherMenu } from '../../spaces/components/my-spaces-switcher-menu';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { memberSurfaceSpaceQuery, resolveMemberSpaceSlug } from './member-menu';
import { useMemberExperience } from './member-experience';

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

/** Same Spaces menu as the desktop home title — mobile members only. */
function MemberMobileSpaceSwitcher() {
  const tNavigation = useTranslations('Navigation');
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const named = useMemberNamedSpaces();
  const [recent, setRecent] = useState<string[]>(() => readRecentSpaceSlugs());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeRecentSpaceSlugs(setRecent), []);

  const slug = useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug: getDhoSpaceSlugFromPathname(pathname) ?? null,
        querySlug: memberSurfaceSpaceQuery(pathname, searchParams.get('space')),
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }),
    [named, pathname, recent, searchParams],
  );
  const { resolvedTheme } = useTheme();
  const { space } = useSpaceBySlug(slug ?? '');
  const namedSpace = named.find((entry) => entry.slug === slug) ?? null;
  const title = space?.title?.trim() || namedSpace?.title?.trim() || slug || '';
  const iconUrl = resolveSpaceDisplayLogoUrl(
    space ?? namedSpace,
    resolvedTheme === 'dark' ? 'dark' : 'light',
  );

  if (!title) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 max-w-[min(12rem,46vw)] items-center gap-1.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase"
          aria-label={tNavigation('mySpaces')}
        >
          <SpaceSwitcherMark iconUrl={iconUrl} alt="" />
          <span className="min-w-0 truncate">{title}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[70] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <div className="h-72">
          <MySpacesSwitcherMenu open={open} onSelect={() => setOpen(false)} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Top-bar control for the mobile spaces list.
 * Builders/funders: circle that opens the rail.
 * Members: the Spaces name dropdown (desktop home already has this on the page).
 */
export function SpacesRailTopToggle() {
  const { active, open, toggle } = useSpacesRailControl();
  const t = useTranslations('MemberHome');
  const { isMember } = useMemberExperience();

  if (!active) return null;

  if (isMember) {
    return <MemberMobileSpaceSwitcher />;
  }

  return (
    <button
      type="button"
      className={cn(APP_CHROME_ICON_TRIGGER, 'xl:hidden')}
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
