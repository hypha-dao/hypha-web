'use client';

import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDhoPathGovernance } from '../@tab/governance/constants';
import { getDhoPathMembership } from '../@tab/membership/constants';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoPathTreasury } from '../@tab/treasury/constants';
import { getDhoPathOrganisation } from '../@tab/organisation/constants';
import { ScrollArea, ScrollBar } from '@hypha-platform/ui';

export function NavigationTabs({ lang, id }: { lang: Locale; id: string }) {
  const pathname = usePathname();
  const activeTab = getActiveTabFromPath(pathname);

  const tabs = [
    {
      title: 'Organisation',
      name: 'organisation',
      href: getDhoPathOrganisation(lang, id),
    },
    {
      title: 'Governance',
      name: 'governance',
      href: getDhoPathGovernance(lang, id),
    },
    {
      title: 'Membership',
      name: 'membership',
      href: getDhoPathMembership(lang as Locale, id as string),
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
                role="group"
              >
                <Link href={href} className="w-full" passHref>
                  {title}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollBar orientation="horizontal" hidden={true} />
      </ScrollArea>
    </Tabs>
  );
}
