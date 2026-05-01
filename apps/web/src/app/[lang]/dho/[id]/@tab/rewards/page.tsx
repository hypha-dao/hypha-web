import { Locale } from '@hypha-platform/i18n';
import {
  DhoTabPage,
  SpacePendingRewardsSection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RewardsPage(props: PageProps) {
  const params = await props.params;
  const { id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) {
    notFound();
  }
  const web3SpaceId = spaceFromDb.web3SpaceId ?? undefined;

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <DhoTabPage>
        {typeof web3SpaceId === 'number' && Number.isFinite(web3SpaceId) ? (
          <SpacePendingRewardsSection web3SpaceId={web3SpaceId} />
        ) : null}
      </DhoTabPage>
    </SpaceTabAccessWrapper>
  );
}
