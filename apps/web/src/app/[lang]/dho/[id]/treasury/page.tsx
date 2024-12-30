import { Locale } from '@hypha-platform/i18n';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@hypha-platform/ui/server';
import Link from 'next/link';
import {
  AssetsSection,
  PayoutsSection,
  RequestsSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  return (
    <div>
      <NavigationTabs lang={lang} id={id} activeTab="treasury" />
      <AssetsSection />
      <RequestsSection />
      <PayoutsSection />
    </div>
  );
}
