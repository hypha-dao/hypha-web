import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { RewardsMainPanel } from '../../_components/rewards-main-panel';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RewardsPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb?.web3SpaceId as number}
      spaceSlug={id}
    >
      <RewardsMainPanel
        lang={lang}
        spaceSlug={id}
        web3SpaceId={spaceFromDb?.web3SpaceId as number}
      />
    </SpaceTabAccessWrapper>
  );
}
