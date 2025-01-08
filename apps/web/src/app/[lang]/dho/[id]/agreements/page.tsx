import { Locale } from '@hypha-platform/i18n';
import {
  DiscussionsSection,
  AgreementsSection,
  ProposalsSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = `/${lang}/dho/${id}`;

  return (
    <div>
      <NavigationTabs lang={lang} id={id} activeTab="agreements" />
      <DiscussionsSection basePath={`${basePath}/discussions`} />
      <ProposalsSection basePath={`${basePath}/proposals`} />
      <AgreementsSection />
    </div>
  );
}
