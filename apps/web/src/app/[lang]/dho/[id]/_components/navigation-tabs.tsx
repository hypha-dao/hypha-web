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
import useEmblaCarousel from 'embla-carousel-react';

export function NavigationTabs({ lang, id }: { lang: Locale; id: string }) {
  const pathname = usePathname();
  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    axis: 'x',
    startIndex: 0,
  });
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
    <Tabs
      value={activeTab}
      className="w-full mt-16 overflow-hidden"
      ref={emblaRef}
    >
      {/* <div className="overflow-hidden" ref={emblaRef}> */}
      {/* <TabsList className="flex touch-pan-y w-full mb-4"> */}
      <TabsList className="flex mb-4">
        {tabs.map((tab) => (
          <TabsTrigger
            asChild
            key={tab.name}
            value={tab.name}
            // className="w-full"
            className="flex-none"
            variant="ghost"
            role="group"
            aria-roledescription="slide"
            // style="flex: 0 0 auto;"
          >
            <Link href={tab.href} className="w-full" passHref>
              {tab.title}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      {/* </div> */}
      {/* <TabsList className="w-full mb-4">
        <TabsTrigger
          asChild
          value="organisation"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={getDhoPathOrganisation(lang, id)}
            className="w-full"
            passHref
          >
            Organisation
          </Link>
        </TabsTrigger>
        <TabsTrigger
          asChild
          value="governance"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={getDhoPathGovernance(lang, id)}
            className="w-full"
            passHref
          >
            Governance
          </Link>
        </TabsTrigger>
        <TabsTrigger
          asChild
          value="membership"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={getDhoPathMembership(lang as Locale, id as string)}
            className="w-full"
            passHref
          >
            Membership
          </Link>
        </TabsTrigger>
        <TabsTrigger
          asChild
          value="treasury"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={getDhoPathTreasury(lang as Locale, id as string)}
            className="w-full"
            passHref
          >
            Treasury
          </Link>
        </TabsTrigger>
      </TabsList> */}
    </Tabs>
  );
}
