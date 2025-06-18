import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { DocumentsSections } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;

  const spaceService = createSpaceService();
  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const web3SpaceId = spaceFromDb.web3SpaceId;

  return (
    <DocumentsSections
      lang={lang}
      spaceSlug={id}
      web3SpaceId={web3SpaceId as number}
    />
  );
}
