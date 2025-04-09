import { Locale } from '@hypha-platform/i18n';
import { DocumentSection } from '@hypha-platform/epics';
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
    <div className="flex flex-col gap-6 py-4">
      <NavigationTabs lang={lang} id={id} activeTab="agreements" />
      <DocumentSection
        basePath={`${basePath}/proposals`}
        useDocuments={useSpaceDocuments}
        documentState="proposal"
        label="Proposals"
        hasSearch={true}
      />
      <DocumentSection
        basePath={`${basePath}/agreements`}
        useDocuments={useSpaceDocuments}
        documentState="agreement"
        label="Agreements"
        hasSearch={true}
      />
      <DocumentSection
        basePath={`${basePath}/agreements`}
        useDocuments={useSpaceDocuments}
        documentState="agreement"
        label="History"
        hasSearch={true}
      />
    </div>
  );
}
