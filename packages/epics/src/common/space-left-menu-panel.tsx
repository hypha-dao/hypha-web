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
      <SidebarHeader className="bg-background-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-sm font-semibold text-foreground transition-opacity',
              iconOnly && 'sr-only',
            )}
          >
            {t('leftMenu.title')}
          </p>
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
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {iconOnly ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-background-2">
        <SidebarMenu className="px-2 py-3">
          {items.map(({ key, href, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={iconOnly ? label : undefined}
                  className={cn(
                    'h-11 gap-3 rounded-lg px-3 text-sm',
                    iconOnly && 'justify-center px-0',
                  )}
                >
                  <Link href={href} aria-label={label}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {!iconOnly ? <span>{label}</span> : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="bg-background-2 border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          {t('leftMenu.footerHint')}
        </p>
      </SidebarFooter>
    </>
  );
}
