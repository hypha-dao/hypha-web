import { Locale } from '@hypha-platform/i18n';
import {
  AgreementsSection,
  ProposalsSection,
  DocumentSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = `/${lang}/dho/${id}`;

  return (
    <div className="flex flex-col gap-4">
      <NavigationTabs lang={lang} id={id} activeTab="agreements" />
      <DocumentSection
        basePath={`${basePath}/discussions`}
        useDocuments={useSpaceDocuments}
        documentState="discussion"
      />
      <ProposalsSection
        basePath={`${basePath}/proposals`}
        useDocuments={useSpaceDocuments}
      />
      <AgreementsSection
        basePath={`${basePath}/agreements`}
        useDocuments={useSpaceDocuments}
      />
    </div>
  );
}
