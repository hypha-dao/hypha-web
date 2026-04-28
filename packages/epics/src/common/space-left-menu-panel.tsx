'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  ChevronLeft,
  ChevronRight,
  Coins,
  FileCheck2,
  Radio,
  Users,
} from 'lucide-react';

import { useAiPanel } from './human-chat-panel-context';
import { getActiveTabFromPath } from './get-active-tab-from-path';

type SpaceLeftMenuItem = {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function getSpaceBasePath(pathname: string): string | null {
  const match = pathname.match(/^\/([^/]+)\/dho\/([^/]+)/);
  if (!match) return null;
  const lang = match[1];
  const spaceSlug = match[2];
  if (!lang || !spaceSlug) return null;
  return `/${lang}/dho/${spaceSlug}`;
}

export function SpaceLeftMenuPanel() {
  const pathname = usePathname();
  const t = useTranslations('AiPanel');
  const { menuDensity, toggleMenuDensity } = useAiPanel();

  const basePath = getSpaceBasePath(pathname ?? '');
  const activeTab = getActiveTabFromPath(pathname ?? '');
  const iconOnly = menuDensity === 'icon';

  const items: SpaceLeftMenuItem[] = basePath
    ? [
        {
          key: 'coherence',
          href: `${basePath}/coherence`,
          label: t('leftMenu.signals'),
          icon: Radio,
        },
        {
          key: 'agreements',
          href: `${basePath}/agreements`,
          label: t('leftMenu.proposals'),
          icon: FileCheck2,
        },
        {
          key: 'members',
          href: `${basePath}/members`,
          label: t('leftMenu.members'),
          icon: Users,
        },
        {
          key: 'treasury',
          href: `${basePath}/treasury`,
          label: t('leftMenu.treasury'),
          icon: Coins,
        },
      ]
    : [];

  return (
    <>
      <SidebarContent className="relative bg-background-2">
        <div className="relative flex h-full">
          <nav
            className="z-10 flex h-full w-14 shrink-0 flex-col border-r border-border bg-background-2"
            aria-label={t('leftMenu.title')}
          >
            <SidebarHeader className="border-b border-border p-2">
              <button
                type="button"
                onClick={toggleMenuDensity}
                aria-label={
                  iconOnly
                    ? t('leftMenu.expandMenuAriaLabel')
                    : t('leftMenu.collapseMenuAriaLabel')
                }
                title={
                  iconOnly
                    ? t('leftMenu.expandMenuAriaLabel')
                    : t('leftMenu.collapseMenuAriaLabel')
                }
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {iconOnly ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </SidebarHeader>
            <SidebarMenu className="px-2 py-3">
              {items.map(({ key, href, label, icon: Icon }) => {
                const active = activeTab === key;
                return (
                  <SidebarMenuItem key={`rail-${key}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className="h-11 justify-center rounded-lg px-0"
                    >
                      <Link href={href} aria-label={label}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>

          <div
            className={cn(
              'absolute inset-y-0 left-14 right-0 z-20 transition-all duration-200 ease-linear',
              iconOnly
                ? 'pointer-events-none -translate-x-2 opacity-0'
                : 'pointer-events-auto translate-x-0 opacity-100',
            )}
          >
            <div className="flex h-full flex-col border-r border-border bg-background-2 shadow-[6px_0_24px_-16px_rgba(0,0,0,0.65)]">
              <SidebarHeader className="border-b border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t('leftMenu.title')}
                  </p>
                  <button
                    type="button"
                    onClick={toggleMenuDensity}
                    aria-label={t('leftMenu.collapseMenuAriaLabel')}
                    title={t('leftMenu.collapseMenuAriaLabel')}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </SidebarHeader>
              <SidebarMenu className="px-2 py-3">
                {items.map(({ key, href, label, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <SidebarMenuItem key={`overlay-${key}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="h-11 gap-3 rounded-lg px-3 text-sm"
                      >
                        <Link href={href} aria-label={label}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              <SidebarFooter className="mt-auto border-t border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {t('leftMenu.footerHint')}
                </p>
              </SidebarFooter>
            </div>
          </div>
        </div>
      </SidebarContent>
    </>
  );
}
