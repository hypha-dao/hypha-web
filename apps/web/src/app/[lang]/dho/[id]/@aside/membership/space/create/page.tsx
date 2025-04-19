import { CreateSubspaceForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateSubspacePage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const spaceId = spaceFromDb.id;

  return (
    <SidePanel>
      <CreateSubspaceForm
        successfulUrl={getDhoPathAgreements(lang as Locale, id)}
        parentSpaceId={spaceId}
      />
    </SidePanel>
  );
}
