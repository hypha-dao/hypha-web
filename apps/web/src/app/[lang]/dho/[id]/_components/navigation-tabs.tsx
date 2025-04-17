'use client';

import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { getDhoPathTreasury } from '../_tabs/treasury/constants';
import { getDhoPathMembership } from '../@tab/membership/constants';
import { getActiveTabFromPath } from './get-active-tab-from-path';

export function NavigationTabs({ lang, id }: { lang: Locale; id: string }) {
  const pathname = usePathname();
  const activeTab = getActiveTabFromPath(pathname);

  return (
    <Tabs value={activeTab} className="w-full mt-16">
      <TabsList className="w-full mb-4">
        <TabsTrigger
          asChild
          value="agreements"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={getDhoPathAgreements(lang, id)}
            className="w-full"
            passHref
          >
            Agreements
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
      </TabsList>
    </Tabs>
  );
}
