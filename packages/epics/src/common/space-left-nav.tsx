'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  FileCheck,
  Gift,
  LayoutGrid,
  Radio,
  Settings,
  Users,
  Vault,
  Library,
} from 'lucide-react';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { getCookie, HYPHA_ENABLE_COHERENCE } from '@hypha-platform/cookie';

import { getActiveTabFromPath } from './get-active-tab-from-path';
import {
  getDhoPathAgreements,
  getDhoPathCoherence,
  getDhoPathMembers,
  getDhoPathSpaceConfiguration,
  getDhoPathTreasury,
} from './get-path-function';
import { useSpaceNavIntent } from './space-nav-intent-context';

const LEFT_NAV_LABELS_KEY = 'hypha.leftNav.labelsExpanded';

type NavItem = {
  name: string;
  href: string;
  labelKey: 'signals' | 'proposals' | 'members' | 'treasury';
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  /** If false, item is not shown */
  show?: boolean;
  disabled?: boolean;
};

type StubItem = {
  key: string;
  labelKey: 'ecosystem' | 'rewards' | 'memory' | 'spaceSettings';
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
};

function readCoherenceEnabledFromCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const v = getCookie(HYPHA_ENABLE_COHERENCE);
  return v === 'true' || v === '1';
}

function useLeftNavCoherenceEnabled(serverCoherenceEnabled: boolean): boolean {
  const [clientCoherence, setClientCoherence] = React.useState(
    () => readCoherenceEnabledFromCookie() || serverCoherenceEnabled,
  );

  React.useEffect(() => {
    setClientCoherence(
      readCoherenceEnabledFromCookie() || serverCoherenceEnabled,
    );
  }, [serverCoherenceEnabled]);

  return clientCoherence;
}

function useLabelsExpanded() {
  const [labelsExpanded, setLabelsExpanded] = React.useState(true);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LEFT_NAV_LABELS_KEY);
      if (raw === '0') setLabelsExpanded(false);
      if (raw === '1') setLabelsExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLabels = React.useCallback(() => {
    setLabelsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LEFT_NAV_LABELS_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { labelsExpanded, toggleLabels };
}

export function SpaceLeftNav({
  coherenceEnabled: serverCoherenceEnabled,
}: {
  /** From `getEnableCoherence()` — SSR baseline; client also reads HYPHA_ENABLE_COHERENCE cookie. */
  coherenceEnabled: boolean;
}) {
  const params = useParams<{ id?: string; lang?: string }>();
  const pathname = usePathname();
  const t = useTranslations('Common');
  const tSpaceNav = useTranslations('SpaceLeftNav');
  const spaceNav = useSpaceNavIntent();

  const id = params?.id ?? '';
  const lang = (params?.lang as Locale) ?? 'en';

  const coherenceEnabled = useLeftNavCoherenceEnabled(serverCoherenceEnabled);
  const activeTab = getActiveTabFromPath(pathname ?? '');
  const { labelsExpanded, toggleLabels } = useLabelsExpanded();

  const mainItems: NavItem[] = React.useMemo(
    () =>
      [
        {
          name: 'coherence',
          href: getDhoPathCoherence(lang, id),
          labelKey: 'signals',
          icon: Radio,
          testId: 'space-left-nav-signals',
          show: coherenceEnabled,
        },
        {
          name: 'agreements',
          href: getDhoPathAgreements(lang, id),
          labelKey: 'proposals',
          icon: FileCheck,
          testId: 'space-left-nav-proposals',
        },
        {
          name: 'members',
          href: getDhoPathMembers(lang, id),
          labelKey: 'members',
          icon: Users,
          testId: 'space-left-nav-members',
        },
        {
          name: 'treasury',
          href: getDhoPathTreasury(lang, id),
          labelKey: 'treasury',
          icon: Vault,
          testId: 'space-left-nav-treasury',
        },
      ] as const,
    [coherenceEnabled, id, lang],
  );

  const stubItems: StubItem[] = React.useMemo(
    () => [
      {
        key: 'ecosystem',
        labelKey: 'ecosystem',
        icon: LayoutGrid,
        testId: 'space-left-nav-ecosystem-stub',
      },
      {
        key: 'rewards',
        labelKey: 'rewards',
        icon: Gift,
        testId: 'space-left-nav-rewards-stub',
      },
      {
        key: 'memory',
        labelKey: 'memory',
        icon: Library,
        testId: 'space-left-nav-memory-stub',
      },
    ],
    [],
  );

  const spaceSettingsHref = getDhoPathSpaceConfiguration(lang, id);

  if (!id) return null;

  return (
    <div className="flex min-h-0 w-full flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-sidebar-border/80 px-1 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/80"
              onClick={toggleLabels}
              aria-pressed={labelsExpanded}
              aria-label={
                labelsExpanded
                  ? tSpaceNav('collapseNavLabels')
                  : tSpaceNav('expandNavLabels')
              }
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform duration-200 ease-linear motion-reduce:transition-none',
                  labelsExpanded ? '' : 'rotate-180',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {labelsExpanded
              ? tSpaceNav('collapseNavLabels')
              : tSpaceNav('expandNavLabels')}
          </TooltipContent>
        </Tooltip>
      </div>

      <nav
        aria-label={tSpaceNav('navAriaLabel')}
        className="flex min-h-0 flex-col gap-0 px-1 pb-2 pt-1"
      >
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainItems.map((item) => {
                if (item.show === false) return null;
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                const label =
                  item.labelKey === 'signals'
                    ? t('Signals')
                    : item.labelKey === 'proposals'
                    ? t('Proposals')
                    : item.labelKey === 'members'
                    ? t('Members')
                    : t('Treasury');

                const buttonInner = (
                  <>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {labelsExpanded ? (
                      <span className="truncate font-medium">{label}</span>
                    ) : null}
                  </>
                );

                return (
                  <SidebarMenuItem key={item.name}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            'h-10 min-h-10',
                            !labelsExpanded && 'justify-center px-0',
                          )}
                        >
                          <Link
                            href={item.href}
                            data-testid={item.testId}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => spaceNav?.noteManualNavigation()}
                          >
                            {buttonInner}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {!labelsExpanded ? (
                        <TooltipContent side="right">{label}</TooltipContent>
                      ) : null}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}

              {stubItems.map((stub) => {
                const Icon = stub.icon;
                const label = tSpaceNav(stub.labelKey);
                return (
                  <SidebarMenuItem key={stub.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          disabled
                          className={cn(
                            'h-10 min-h-10 opacity-50',
                            !labelsExpanded && 'justify-center px-0',
                          )}
                          data-testid={stub.testId}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden />
                          {labelsExpanded ? (
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                              <span className="truncate">{label}</span>
                              <span className="shrink-0 rounded border border-sidebar-border px-1 py-px text-[10px] leading-none text-muted-foreground">
                                {t('comingSoonBadge')}
                              </span>
                            </span>
                          ) : null}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {label} — {t('comingSoonBadge')}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-sidebar-border" />

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname?.includes('/space-configuration') ?? false
                      }
                      className={cn(
                        'h-10 min-h-10',
                        !labelsExpanded && 'justify-center px-0',
                      )}
                    >
                      <Link
                        href={spaceSettingsHref}
                        data-testid="space-left-nav-space-settings"
                        aria-current={
                          pathname?.includes('/space-configuration')
                            ? 'page'
                            : undefined
                        }
                        onClick={() => spaceNav?.noteManualNavigation()}
                      >
                        <Settings className="h-5 w-5 shrink-0" aria-hidden />
                        {labelsExpanded ? (
                          <span className="truncate font-medium">
                            {tSpaceNav('spaceSettings')}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {!labelsExpanded ? (
                    <TooltipContent side="right">
                      {tSpaceNav('spaceSettings')}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </nav>
    </div>
  );
}
