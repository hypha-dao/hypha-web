'use client';

import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { getDhoPathOverview } from '../@tab/overview/constants';

export function NavigationTabs({ lang, id }: { lang: Locale; id: string }) {
  const pathname = usePathname();
  const activeTab = getActiveTabFromPath(pathname);

  const tabs = [
    {
      title: 'Overview',
      name: 'overview',
      href: getDhoPathOverview(lang, id),
    },
    {
      title: 'Agreements',
      name: 'agreements',
      href: getDhoPathAgreements(lang, id),
    },
    {
      title: 'Members',
      name: 'members',
      href: getDhoPathMembers(lang as Locale, id as string),
    },
    {
      title: 'Treasury',
      name: 'treasury',
      href: getDhoPathTreasury(lang as Locale, id as string),
    },
  ];

  return (
    <Tabs value={activeTab} className="w-full mt-16">
      <div className="w-full overflow-x-auto">
        <TabsList>
          {tabs.map(({ name, href, title }, index) => (
            <TabsTrigger
              asChild
              key={`tab-${index}`}
              value={name}
              variant="ghost"
            >
              <Link href={href} passHref>
                {title}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
