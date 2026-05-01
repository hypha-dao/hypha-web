import { Locale } from '@hypha-platform/i18n';
import {
  SpaceTabAccessWrapper,
  TreasuryTabbedView,
} from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb?.web3SpaceId as number}
      spaceSlug={id}
    >
      <TreasuryTabbedView
        lang={lang}
        spaceSlug={id}
        web3SpaceId={
          typeof spaceFromDb?.web3SpaceId === 'number' &&
          Number.isFinite(spaceFromDb.web3SpaceId)
            ? spaceFromDb.web3SpaceId
            : undefined
        }
      />
    </SpaceTabAccessWrapper>
  );
}
