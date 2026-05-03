'use client';

import * as React from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
// import { getDhoPathOverview } from '../@tab/overview/constants'; // Overview tab removed
import { cn } from '@hypha-platform/ui-utils';
import {
  getActiveTabFromPath,
  useMainColumnScrollY,
} from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../@tab/coherence/constants';

/** Subtle scroll parallax: tab strip drifts slightly vs page for depth (see CompactSpaceBannerLead). */
const TAB_PARALLAX_SCROLL_RATE = 0.07;
const TAB_PARALLAX_MAX_SHIFT_PX = 18;

function clampTabParallaxScrollY(scrollY: number): number {
  return Math.min(
    TAB_PARALLAX_MAX_SHIFT_PX,
    Math.max(-TAB_PARALLAX_MAX_SHIFT_PX, scrollY * TAB_PARALLAX_SCROLL_RATE),
  );
}

function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

export function NavigationTabs({
  lang,
  id,
  coherenceEnabled = false,
  variant = 'page',
}: {
  lang: Locale;
  id: string;
  /** When true, show the Coherence tab (from `getEnableCoherence()` on the server). */
  coherenceEnabled?: boolean;
  variant?: 'page' | 'sticky';
}) {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const activeTab = React.useMemo(
    () => getActiveTabFromPath(pathname),
    [pathname],
  );

  const mainScrollY = useMainColumnScrollY();
  const [preferReducedMotion, setPreferReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const sync = () => {
      setPreferReducedMotion(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const tabParallaxY =
    variant === 'sticky' || preferReducedMotion || isReducedMotionPreferred()
      ? 0
      : clampTabParallaxScrollY(mainScrollY);

  const tabs = [
    ...(coherenceEnabled
      ? [
          {
            title: t('Signals'),
            name: 'coherence',
            href: getDhoPathCoherence(lang, id),
          },
        ]
      : []),
    {
      title: t('Agreements'),
      name: 'agreements',
      href: getDhoPathAgreements(lang, id),
    },
    {
      title: t('Members'),
      name: 'members',
      href: getDhoPathMembers(lang as Locale, id as string),
    },
    {
      title: t('Treasury'),
      name: 'treasury',
      href: getDhoPathTreasury(lang as Locale, id as string),
    },
  ];

  return (
    <Tabs
      value={activeTab}
      className={cn('w-full', variant === 'page' ? 'mt-6 md:mt-7' : '')}
    >
      {/*
        Radix ScrollArea's viewport forces overflow-y: hidden, which clips vertical parallax.
        Native overflow-x-auto keeps horizontal swipe/scroll; vertical padding absorbs translate.
      */}
      <div
        className={cn(
          'w-full overflow-x-auto overflow-y-visible overscroll-x-contain',
          'touch-pan-x touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          variant === 'page' ? 'mb-4 py-[18px]' : 'py-1',
        )}
      >
        <TabsList
          className={cn(
            'flex min-w-max will-change-transform md:min-w-0 md:w-full',
            variant === 'page' ? 'h-10' : 'h-9',
          )}
          style={
            variant === 'sticky' || preferReducedMotion
              ? undefined
              : { transform: `translate3d(0, ${tabParallaxY}px, 0)` }
          }
        >
          {tabs.map(({ name, href, title }) => (
            <TabsTrigger asChild key={name} value={name} variant="ghost">
              <Link href={href} scroll={false} className="w-full" passHref>
                {title}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
