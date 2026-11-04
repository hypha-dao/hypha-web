import { Locale } from '@hypha-platform/i18n';
import { BankingSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function BankingPage(props: PageProps) {
  const params = await props.params;
  const { id } = params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  const web3SpaceId =
    spaceFromDb?.web3SpaceId != null &&
    canConvertToBigInt(spaceFromDb.web3SpaceId)
      ? Number(spaceFromDb.web3SpaceId)
      : undefined;

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <div className="flex w-full flex-col gap-4 py-4">
        <BankingSection spaceSlug={id} web3SpaceId={web3SpaceId} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
