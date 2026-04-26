'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronsLeft,
  ChevronsRight,
  FileCheck2,
  Gift,
  Library,
  LayoutGrid,
  Radio,
  Settings,
  type LucideIcon,
  Users,
  Vault,
} from 'lucide-react';
import { Locale } from '@hypha-platform/i18n';
import { getActiveTabFromPath } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@hypha-platform/ui';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathWiki } from '../@tab/wiki/constants';
import { getDhoPathCoherence } from '../@tab/coherence/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathSpaces } from '../@tab/spaces/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { getDhoPathRewards } from '../@tab/rewards/constants';
import { cn } from '@hypha-platform/ui-utils';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { cleanPath } from './clean-path';
import { useIsDelegate, useSpaceBySlug } from '@hypha-platform/core/client';
import { useSpaceMember } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';

const NAV_ICON_CLASS = 'h-5 w-5 shrink-0 opacity-80 group-hover:opacity-100';
const NAV_MOTION =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 motion-reduce:animate-none';

const NAV_LABELS_EXPANDED_STORAGE_KEY = 'dho-workspace-nav-labels-expanded';

export type DhoSpaceWorkspaceNavItem = {
  name: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

function useNavItems(
  lang: Locale,
  spaceSlug: string,
  coherenceEnabled: boolean,
  spaceMemoryEnabled: boolean,
): DhoSpaceWorkspaceNavItem[] {
  const t = useTranslations('Common');
  return React.useMemo(
    () => [
      ...(coherenceEnabled
        ? [
            {
              name: 'coherence' as const,
              href: getDhoPathCoherence(lang, spaceSlug),
              label: t('Signals'),
              icon: Radio,
            },
          ]
        : []),
      {
        name: 'agreements',
        href: getDhoPathAgreements(lang, spaceSlug),
        label: t('Agreements'),
        icon: FileCheck2,
      },
      {
        name: 'members',
        href: getDhoPathMembers(lang, spaceSlug),
        label: t('Members'),
        icon: Users,
      },
      {
        name: 'treasury',
        href: getDhoPathTreasury(lang, spaceSlug),
        label: t('Treasury'),
        icon: Vault,
      },
      {
        name: 'rewards',
        href: getDhoPathRewards(lang, spaceSlug),
        label: t('Rewards'),
        icon: Gift,
      },
      ...(spaceMemoryEnabled
        ? [
            {
              name: 'wiki' as const,
              href: getDhoPathWiki(lang, spaceSlug),
              label: t('Wiki'),
              icon: Library,
            },
          ]
        : []),
      {
        name: 'spaces',
        href: getDhoPathSpaces(lang, spaceSlug),
        label: t('Ecosystem'),
        icon: LayoutGrid,
      },
    ],
    [coherenceEnabled, spaceMemoryEnabled, lang, spaceSlug, t],
  );
}

type NavRowProps = {
  name: string;
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onNavigate?: () => void;
  /** `desktop` = icon rail (optional labels); `sheet` = mobile drawer with full labels */
  variant: 'desktop' | 'sheet';
  /** Desktop: when false, icons only; when true, icons + visible labels */
  showLabels?: boolean;
  index: number;
  linkRef?: React.Ref<HTMLAnchorElement>;
};

function NavRow({
  name,
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
  variant,
  showLabels = false,
  index,
  linkRef,
}: NavRowProps) {
  const desktopIconOnly = variant === 'desktop' && !showLabels;
  const itemClass = cn(
    'group flex min-h-11 w-full min-w-0 items-center rounded-md py-2 text-left text-sm font-medium leading-snug',
    desktopIconOnly ? 'justify-center gap-0 px-1.5' : 'gap-1.5 px-1.5',
    'outline-none ring-offset-background transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? [
          'text-foreground [&_svg]:opacity-100',
          'bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_18%,var(--card))]',
          'ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_38%,transparent)]',
          '[&_svg]:text-[var(--space-accent,var(--color-accent-9))]',
        ].join(' ')
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    NAV_MOTION,
  );
  const delay = index * 32;
  const style = { animationDelay: `${delay}ms` };

  const content = (
    <>
      <Icon
        className={cn(NAV_ICON_CLASS, isActive && 'text-foreground')}
        aria-hidden
      />
      {variant === 'sheet' ? (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      ) : showLabels ? (
        <span className="min-w-0 flex-1 overflow-hidden truncate">{label}</span>
      ) : null}
    </>
  );

  if (variant === 'sheet') {
    return (
      <li>
        <Link
          ref={linkRef}
          data-testid={`dho-workspace-nav-${name}`}
          href={href}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={itemClass}
          style={style}
        >
          {content}
        </Link>
      </li>
    );
  }

  const linkEl = (
    <Link
      data-testid={`dho-workspace-nav-${name}`}
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={itemClass}
      style={style}
      aria-label={desktopIconOnly ? label : undefined}
      title={desktopIconOnly ? label : undefined}
    >
      {content}
    </Link>
  );

  return <li className="w-full">{linkEl}</li>;
}

function NavLinkList({
  items,
  activeName,
  onNavigate,
  variant,
  showLabels,
  className,
  firstLinkRef,
  listId,
}: {
  items: DhoSpaceWorkspaceNavItem[];
  activeName: string;
  onNavigate?: () => void;
  variant: 'desktop' | 'sheet';
  showLabels?: boolean;
  className?: string;
  firstLinkRef?: React.Ref<HTMLAnchorElement>;
  listId?: string;
}) {
  return (
    <ul
      id={listId}
      className={cn('flex list-none flex-col gap-0.5 p-0', className)}
      role="list"
    >
      {items.map((item, index) => {
        const isActive = activeName === item.name;
        return (
          <NavRow
            key={item.name}
            name={item.name}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isActive}
            onNavigate={onNavigate}
            variant={variant}
            showLabels={showLabels}
            index={index}
            linkRef={
              index === 0 && variant === 'sheet' ? firstLinkRef : undefined
            }
          />
        );
      })}
    </ul>
  );
}

export function DhoSpaceWorkspace({
  lang,
  id,
  coherenceEnabled,
  spaceMemoryEnabled,
  children,
}: {
  lang: Locale;
  id: string;
  coherenceEnabled: boolean;
  spaceMemoryEnabled: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('DhoWorkspaceNav');
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const activeName = getActiveTabFromPath(pathname) ?? '';
  const items = useNavItems(lang, id, coherenceEnabled, spaceMemoryEnabled);
  const titleId = React.useId();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const openButtonRef = React.useRef<HTMLButtonElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);
  const hadSheetOpen = React.useRef(false);

  const navListId = React.useId();
  const [labelsExpanded, setLabelsExpanded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_LABELS_EXPANDED_STORAGE_KEY);
      if (raw === '1') setLabelsExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        NAV_LABELS_EXPANDED_STORAGE_KEY,
        labelsExpanded ? '1' : '0',
      );
    } catch {
      /* ignore */
    }
  }, [labelsExpanded]);

  const closeSheet = React.useCallback(() => {
    setSheetOpen(false);
  }, []);

  React.useEffect(() => {
    if (sheetOpen) {
      hadSheetOpen.current = true;
      const tId = window.setTimeout(() => {
        firstLinkRef.current?.focus();
      }, 0);
      return () => clearTimeout(tId);
    }
    if (hadSheetOpen.current) {
      openButtonRef.current?.focus();
    }
  }, [sheetOpen]);

  const { space } = useSpaceBySlug(id);
  const rawWeb3 = space?.web3SpaceId;
  const web3SpaceId =
    typeof rawWeb3 === 'number' && Number.isFinite(rawWeb3)
      ? rawWeb3
      : undefined;
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId });
  const settingsDisabled =
    !isAuthenticated || web3SpaceId === undefined || (!isMember && !isDelegate);
  const settingsTooltip = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : t('openSpaceSettings');
  const settingsHref = !settingsDisabled
    ? `${cleanPath(pathname)}${PATH_SELECT_SETTINGS_ACTION}`
    : '';

  return (
    <div className="flex w-full min-w-0 flex-col gap-0 md:flex-row">
      <nav
        className={cn(
          'hidden shrink-0 pt-4 transition-[width] duration-200 ease-out md:flex md:flex-col md:self-stretch',
          labelsExpanded
            ? 'w-[min(10rem,100%)] pl-0 pr-1'
            : 'w-[3.5rem] pl-0 pr-0.5',
        )}
        aria-label={t('spaceNavAriaLabel')}
      >
        <div
          className={cn(
            'mb-2 flex',
            labelsExpanded ? 'justify-end px-0.5' : 'justify-center',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-expanded={labelsExpanded}
            aria-controls={navListId}
            onClick={() => setLabelsExpanded((v) => !v)}
            data-testid="dho-workspace-nav-toggle-labels"
          >
            {labelsExpanded ? (
              <ChevronsLeft className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronsRight className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">
              {labelsExpanded ? t('collapseNavLabels') : t('expandNavLabels')}
            </span>
          </Button>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <NavLinkList
            items={items}
            activeName={activeName}
            variant="desktop"
            showLabels={labelsExpanded}
            listId={navListId}
            className="min-w-0 flex-1"
          />
          <div
            className={cn(
              'mt-auto border-t border-border/60 pt-2',
              labelsExpanded ? 'px-0.5' : 'flex justify-center px-0',
            )}
          >
            {settingsDisabled || !settingsHref ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                className="h-11 w-11 shrink-0 text-muted-foreground"
                title={settingsTooltip}
                aria-label={t('openSpaceSettings')}
                data-testid="dho-workspace-nav-settings"
              >
                <Settings className={NAV_ICON_CLASS} aria-hidden />
              </Button>
            ) : (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
                data-testid="dho-workspace-nav-settings"
              >
                <Link
                  href={settingsHref}
                  scroll={false}
                  title={settingsTooltip}
                  aria-label={t('openSpaceSettings')}
                >
                  <Settings className={NAV_ICON_CLASS} aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div
        className="min-w-0 flex-1 py-0 [container-type:inline-size]"
        data-testid="dho-workspace-main"
      >
        {children}
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-2 md:hidden"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="pointer-events-auto flex justify-end">
          <Button
            ref={openButtonRef}
            type="button"
            variant="outline"
            size="default"
            className="h-12 min-w-12 touch-manipulation shadow-md"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-controls="dho-workspace-menu"
            aria-haspopup="dialog"
            aria-label={t('openSpaceMenu')}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden />
            <span className="ml-1.5 text-sm font-medium">
              {t('openSpaceMenu')}
            </span>
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          id="dho-workspace-menu"
          side="left"
          className="flex w-[min(20rem,100vw)] flex-col gap-0 p-0"
          showClose
          closeLabel={t('closeMenu')}
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle id={titleId} className="text-base">
              {t('spaceMenuTitle')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <nav aria-label={t('spaceNavAriaLabel')}>
                <NavLinkList
                  items={items}
                  activeName={activeName}
                  onNavigate={closeSheet}
                  variant="sheet"
                  firstLinkRef={firstLinkRef}
                />
              </nav>
            </div>
            <div className="shrink-0 border-t border-border p-2">
              {settingsDisabled || !settingsHref ? (
                <div
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
                  title={settingsTooltip}
                >
                  <Settings
                    className="h-5 w-5 shrink-0 opacity-80"
                    aria-hidden
                  />
                  <span>{t('openSpaceSettings')}</span>
                </div>
              ) : (
                <Link
                  href={settingsHref}
                  scroll={false}
                  onClick={closeSheet}
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  title={settingsTooltip}
                  aria-label={t('openSpaceSettings')}
                >
                  <Settings
                    className="h-5 w-5 shrink-0 opacity-80"
                    aria-hidden
                  />
                  <span>{t('openSpaceSettings')}</span>
                </Link>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
