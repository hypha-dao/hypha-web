import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { HomeTokenHoldingsDashboardLazy } from './_components/home-token-holdings-dashboard-lazy';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function OrganisationPage(props: PageProps) {
  const params = await props.params;

  const { id } = params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <HomeTokenHoldingsDashboardLazy spaceSlug={id} />
    </SpaceTabAccessWrapper>
  );
}
