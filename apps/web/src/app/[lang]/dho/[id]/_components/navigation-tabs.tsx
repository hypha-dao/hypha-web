'use client';

import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathMembers } from '../@tab/members/constants';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
// import { getDhoPathOverview } from '../@tab/overview/constants'; // Overview tab removed
import { ScrollArea, ScrollBar } from '@hypha-platform/ui';
import { getActiveTabFromPath } from '@hypha-platform/epics';

export function NavigationTabs({ lang, id }: { lang: Locale; id: string }) {
  const pathname = usePathname();
  const activeTab = getActiveTabFromPath(pathname);

  const tabs = [
    // Overview tab removed - functionality replaced by space-visualization
    // {
    //   title: 'Overview',
    //   name: 'overview',
    //   href: getDhoPathOverview(lang, id),
    // },
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
    <Tabs value={activeTab} className="w-full mt-16 overflow-hidden">
      <ScrollArea>
        <div className="w-full relative h-10 mb-4">
          <TabsList className="flex absolute h-10 md:w-full">
            {tabs.map(({ name, href, title }, index) => (
              <TabsTrigger
                asChild
                key={`tab-${index}`}
                value={name}
                variant="ghost"
              >
                <Link href={href} className="w-full" passHref>
                  {title}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </Tabs>
  );
}
