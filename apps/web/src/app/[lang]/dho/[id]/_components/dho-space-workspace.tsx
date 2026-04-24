'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutGrid } from 'lucide-react';
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
import { getDhoPathCoherence } from '../@tab/coherence/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathSpaces } from '../@tab/spaces/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { cn } from '@hypha-platform/ui-utils';

export type DhoSpaceWorkspaceNavItem = {
  name: string;
  href: string;
  label: string;
};

function useNavItems(
  lang: Locale,
  spaceSlug: string,
  coherenceEnabled: boolean,
): DhoSpaceWorkspaceNavItem[] {
  const t = useTranslations('Common');
  return React.useMemo(
    () => [
      ...(coherenceEnabled
        ? [
            {
              name: 'coherence' as const,
              href: getDhoPathCoherence(lang, spaceSlug),
              label: t('Coherence'),
            },
          ]
        : []),
      {
        name: 'agreements',
        href: getDhoPathAgreements(lang, spaceSlug),
        label: t('Agreements'),
      },
      {
        name: 'members',
        href: getDhoPathMembers(lang, spaceSlug),
        label: t('Members'),
      },
      {
        name: 'treasury',
        href: getDhoPathTreasury(lang, spaceSlug),
        label: t('Treasury'),
      },
      {
        name: 'spaces',
        href: getDhoPathSpaces(lang, spaceSlug),
        label: t('Spaces'),
      },
    ],
    [coherenceEnabled, lang, spaceSlug, t],
  );
}

function NavLinkList({
  items,
  activeName,
  onNavigate,
  className,
}: {
  items: DhoSpaceWorkspaceNavItem[];
  activeName: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-0.5 p-0', className)} role="list">
      {items.map(({ name, href, label }) => {
        const isActive = activeName === name;
        return (
          <li key={name}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'block min-h-11 w-full rounded-md px-3 py-2.5 text-sm font-medium leading-snug',
                'outline-none ring-offset-background transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-accent/15 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DhoSpaceWorkspace({
  lang,
  id,
  coherenceEnabled,
  children,
}: {
  lang: Locale;
  id: string;
  coherenceEnabled: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('DhoWorkspaceNav');
  const pathname = usePathname();
  const activeName = getActiveTabFromPath(pathname);
  const items = useNavItems(lang, id, coherenceEnabled);
  const titleId = React.useId();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const openButtonRef = React.useRef<HTMLButtonElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);
  const hadSheetOpen = React.useRef(false);

  const closeSheet = React.useCallback(() => {
    setSheetOpen(false);
  }, []);

  React.useEffect(() => {
    if (sheetOpen) {
      hadSheetOpen.current = true;
      const t = window.setTimeout(() => {
        firstLinkRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
    if (hadSheetOpen.current) {
      openButtonRef.current?.focus();
    }
  }, [sheetOpen]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-0 md:flex-row">
      <nav
        className="hidden w-[min(15rem,100%)] shrink-0 border-r border-border pr-2 md:block"
        aria-label={t('spaceNavAriaLabel')}
      >
        <NavLinkList items={items} activeName={activeName} />
      </nav>

      <div className="min-w-0 flex-1 py-0">{children}</div>

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
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <nav aria-label={t('spaceNavAriaLabel')}>
              <ul className="flex flex-col gap-0.5" role="list">
                {items.map(({ name, href, label }, index) => {
                  const isActive = activeName === name;
                  return (
                    <li key={name}>
                      <Link
                        ref={index === 0 ? firstLinkRef : undefined}
                        href={href}
                        onClick={closeSheet}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'block min-h-11 w-full rounded-md px-3 py-2.5 text-sm font-medium',
                          'outline-none ring-offset-background',
                          'focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-accent/15 text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
