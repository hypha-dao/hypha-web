import { Locale } from '@hypha-platform/i18n';
import {
  SPACE_DASHBOARD_BOARD_VALUE,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { SpaceOpsHome } from './_components/space-ops-home';
import { SpaceOverviewEntry } from './_components/space-overview-entry';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<{ board?: string; invite?: string }>;
};

export default async function OrganisationPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const { id } = params;
  const stay =
    searchParams.board === SPACE_DASHBOARD_BOARD_VALUE ||
    Boolean(searchParams.invite);

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <SpaceOverviewEntry stay={stay}>
        <SpaceOpsHome spaceSlug={id} />
      </SpaceOverviewEntry>
    </SpaceTabAccessWrapper>
  );
}
