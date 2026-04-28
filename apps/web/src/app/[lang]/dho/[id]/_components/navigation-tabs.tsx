'use client';

import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { cn } from '@hypha-platform/ui-utils';
import { getActiveTabFromPath } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../@tab/coherence/constants';
import { FileCheck2, HandCoins, Radio, UsersRound } from 'lucide-react';

export function NavigationTabs({
  lang,
  id,
  coherenceEnabled = false,
}: {
  lang: Locale;
  id: string;
  /** When true, show the Coherence tab (from `getEnableCoherence()` on the server). */
  coherenceEnabled?: boolean;
}) {
  const t = useTranslations('Common');
  const tCoherence = useTranslations('CoherenceTab');
  const pathname = usePathname();
  const activeTab = getActiveTabFromPath(pathname);
  const menuItems = [
    ...(coherenceEnabled
      ? [
          {
            title: tCoherence('signals'),
            name: 'coherence',
            icon: Radio,
            href: getDhoPathCoherence(lang, id),
          },
        ]
      : []),
    {
      title: t('Agreements'),
      name: 'agreements',
      icon: FileCheck2,
      href: getDhoPathAgreements(lang, id),
    },
    {
      title: t('Members'),
      name: 'members',
      icon: UsersRound,
      href: getDhoPathMembers(lang, id),
    },
    {
      title: t('Treasury'),
      name: 'treasury',
      icon: HandCoins,
      href: getDhoPathTreasury(lang, id),
    },
  ];

  return (
    <nav className="mt-6 w-full md:mt-7" aria-label="Space navigation">
      <div className="mb-4 w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-2 md:min-w-0 md:gap-3">
          {menuItems.map(({ name, href, title, icon: Icon }) => (
            <Link
              key={name}
              href={href}
              aria-current={activeTab === name ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                activeTab === name
                  ? 'border-accent-9/40 bg-accent-9/18 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{title}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
