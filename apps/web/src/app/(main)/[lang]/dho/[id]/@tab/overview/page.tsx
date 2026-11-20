import { Locale } from '@hypha-platform/i18n';
import {
  SPACE_DASHBOARD_BOARD_VALUE,
  SpaceInviteArrival,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';

import { SpaceOpsHome } from './_components/space-ops-home';
import { SpaceOverviewForViewer } from './_components/space-overview-for-viewer';

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
      <SpaceOverviewForViewer
        lang={params.lang}
        spaceSlug={id}
        stay={stay}
        inviteToken={searchParams.invite}
      >
        {searchParams.invite ? (
          <div className="px-4 pt-4 sm:px-5">
            <SpaceInviteArrival
              lang={params.lang}
              token={searchParams.invite}
            />
          </div>
        ) : null}
        <SpaceOpsHome spaceSlug={id} />
      </SpaceOverviewForViewer>
    </SpaceTabAccessWrapper>
  );
}
