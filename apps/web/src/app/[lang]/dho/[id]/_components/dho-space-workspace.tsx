'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  FileCheck2,
  LayoutGrid,
  Radio,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathArtifact } from '../@tab/artifact/constants';
import { getDhoPathCoherence } from '../@tab/coherence/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathSpaces } from '../@tab/spaces/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { cn } from '@hypha-platform/ui-utils';

const NAV_ICON_CLASS = 'h-5 w-5 shrink-0 opacity-80 group-hover:opacity-100';
const NAV_MOTION =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 motion-reduce:animate-none';

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
      ...(spaceMemoryEnabled
        ? [
            {
              name: 'artifact' as const,
              href: getDhoPathArtifact(lang, spaceSlug),
              label: t('Artifact'),
              icon: BookOpen,
            },
          ]
        : []),
      {
        name: 'spaces',
        href: getDhoPathSpaces(lang, spaceSlug),
        label: t('Spaces'),
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
  /** `desktop` = compact icon rail; `sheet` = mobile drawer with full labels */
  variant: 'desktop' | 'sheet';
  index: number;
  linkRef?: React.Ref<HTMLAnchorElement>;
  reducedMotion: boolean;
};

function NavRow({
  name,
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
  variant,
  index,
  linkRef,
  reducedMotion,
}: NavRowProps) {
  const itemClass = cn(
    'group flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium leading-snug',
    'outline-none ring-offset-background transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-accent/15 text-foreground [&_svg]:opacity-100'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    !reducedMotion && NAV_MOTION,
  );
  const delay = reducedMotion ? 0 : index * 32;
  const style = reducedMotion ? undefined : { animationDelay: `${delay}ms` };

  const content = (
    <>
      <Icon
        className={cn(NAV_ICON_CLASS, isActive && 'text-foreground')}
        aria-hidden
      />
      {variant === 'sheet' ? (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      ) : (
        <span
          className="min-w-0 flex-1 max-xl:sr-only xl:inline xl:overflow-hidden xl:truncate"
          // Keep label in DOM for SR when using sr-only at md–lg; avoids duplicate with tooltip
        >
          {label}
        </span>
      )}
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

  return (
    <li className="w-full" style={style}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            data-testid={`dho-workspace-nav-${name}`}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={itemClass}
            title={undefined}
          >
            {content}
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={6}
          className="max-xl:block xl:hidden"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function NavLinkList({
  items,
  activeName,
  onNavigate,
  variant,
  className,
  firstLinkRef,
  reducedMotion,
}: {
  items: DhoSpaceWorkspaceNavItem[];
  activeName: string;
  onNavigate?: () => void;
  variant: 'desktop' | 'sheet';
  className?: string;
  firstLinkRef?: React.Ref<HTMLAnchorElement>;
  reducedMotion: boolean;
}) {
  return (
    <ul
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
            index={index}
            reducedMotion={reducedMotion}
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
  const pathname = usePathname();
  const activeName = getActiveTabFromPath(pathname);
  const items = useNavItems(lang, id, coherenceEnabled, spaceMemoryEnabled);
  const titleId = React.useId();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const openButtonRef = React.useRef<HTMLButtonElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);
  const hadSheetOpen = React.useRef(false);

  const [reducedMotion, setReducedMotion] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-0 md:flex-row">
      <nav
        className="hidden w-[4.5rem] shrink-0 border-r border-border pl-0 pr-1 pt-4 md:block xl:min-w-0 xl:w-[min(12.5rem,100%)] xl:pl-0 xl:pr-2"
        aria-label={t('spaceNavAriaLabel')}
      >
        <NavLinkList
          items={items}
          activeName={activeName}
          variant="desktop"
          reducedMotion={reducedMotion}
        />
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
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <nav aria-label={t('spaceNavAriaLabel')}>
              <NavLinkList
                items={items}
                activeName={activeName}
                onNavigate={closeSheet}
                variant="sheet"
                firstLinkRef={firstLinkRef}
                reducedMotion={reducedMotion}
              />
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
