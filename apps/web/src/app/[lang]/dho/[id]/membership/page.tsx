import { Locale } from '@hypha-platform/i18n';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@hypha-platform/ui/server';
import Link from 'next/link';
import {
  OuterSpacesSection,
  InnerSpacesSection,
  MembersSection,
} from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  return (
    <div>
      <Tabs value="membership" className="w-full mt-16">
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
        <OuterSpacesSection />
        <InnerSpacesSection />
        <MembersSection />
      </Tabs>
    </div>
  );
}
