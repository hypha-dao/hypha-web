import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { RewardsMainPanel } from '../../_components/rewards-main-panel';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RewardsPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  const web3SpaceId = spaceFromDb?.web3SpaceId;

  if (!spaceFromDb || web3SpaceId == null) {
    return notFound();
  }

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <RewardsMainPanel lang={lang} spaceSlug={id} web3SpaceId={web3SpaceId} />
    </SpaceTabAccessWrapper>
  );
}
