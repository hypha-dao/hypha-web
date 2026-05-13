import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { HomeTokenHoldingsDashboard } from './_components/home-token-holdings-dashboard';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function OrganisationPage(props: PageProps) {
  const params = await props.params;

  const { id } = params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <HomeTokenHoldingsDashboard spaceSlug={id} />
    </SpaceTabAccessWrapper>
  );
}
