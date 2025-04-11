import { CreateSubspaceForm } from '@hypha-platform/epics';
import { getDhoPathAgreements } from '../../../agreements/constants';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateSubspacePage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const spaceId = spaceFromDb.web3SpaceId;

  return (
    <CreateSubspaceForm
      successfulUrl={getDhoPathAgreements(lang as Locale, id)}
      parentSpaceId={spaceId}
    />
  );
}
