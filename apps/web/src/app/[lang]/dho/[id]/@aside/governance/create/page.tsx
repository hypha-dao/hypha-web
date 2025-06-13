import { CreateAgreementForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { getDhoPathGovernance, selectCreateActionPath } from '../../../@tab/governance/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateAgreementPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const spaceId = spaceFromDb.id;
  const web3SpaceId = spaceFromDb.web3SpaceId;
  const successfulUrl = getDhoPathGovernance(lang as Locale, id);

  return (
    <SidePanel>
      <CreateAgreementForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${selectCreateActionPath}`}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        label="Collective Agreement"
      />
    </SidePanel>
  );
}
