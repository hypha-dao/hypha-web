import { Locale } from '@hypha-platform/i18n';
import {
  SpacePendingRewardsSection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RewardsPage(props: PageProps) {
  const params = await props.params;
  const { id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  const web3SpaceId = spaceFromDb?.web3SpaceId;

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId as number} spaceSlug={id}>
      <div className="flex flex-col gap-6 py-4">
        {typeof web3SpaceId === 'number' && Number.isFinite(web3SpaceId) ? (
          <SpacePendingRewardsSection web3SpaceId={web3SpaceId} />
        ) : null}
      </div>
    </SpaceTabAccessWrapper>
  );
}
