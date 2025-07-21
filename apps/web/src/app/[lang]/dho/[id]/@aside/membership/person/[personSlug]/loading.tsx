import { MemberDetail, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default async function Loading(props: PageProps) {
  const { lang } = await props.params;
  return (
    <SidePanel>
      <MemberDetail
        closeUrl=""
        member={{}}
        isLoading={true}
        basePath=""
        spaces={[]}
        lang={lang as Locale}
        useDocuments={useSpaceDocuments}
      />
    </SidePanel>
  );
}
