import {
  SPACE_DASHBOARD_BOARD_VALUE,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';

import { SpaceOpsHome } from '@web/app/(main)/[lang]/dho/[id]/@tab/overview/_components/space-ops-home';
import { WhiteLabelOverviewEntry } from '@web/components/white-label/overview-entry';
import type { WhiteLabelPageProps } from '../../../../_lib/space';

type PageProps = WhiteLabelPageProps & {
  searchParams: Promise<{ board?: string }>;
};

export default async function WhiteLabelOverviewPage(props: PageProps) {
  const { id: slug } = await props.params;
  const { board } = await props.searchParams;

  return (
    <SpaceTabAccessWrapper spaceSlug={slug}>
      <WhiteLabelOverviewEntry
        spaceSlug={slug}
        stay={board === SPACE_DASHBOARD_BOARD_VALUE}
      >
        <SpaceOpsHome spaceSlug={slug} />
      </WhiteLabelOverviewEntry>
    </SpaceTabAccessWrapper>
  );
}
