import { Locale } from '@hypha-platform/i18n';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import Link from 'next/link';

export function NavigationTabs({
  lang,
  id,
  activeTab,
}: {
  lang: Locale;
  id: string;
  activeTab: string;
}) {
  return (
    <Tabs value={activeTab} className="w-full mt-16">
      <TabsList className="w-full mb-7">
        <TabsTrigger
          asChild
          value="agreements"
          className="w-full"
          variant="ghost"
        >
          <Link
            href={`/${lang}/dho/${id}/agreements`}
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
            href={`/${lang}/dho/${id}/membership`}
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
            href={`/${lang}/dho/${id}/treasury`}
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
