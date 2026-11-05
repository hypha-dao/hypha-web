import { notFound } from 'next/navigation';
import { BankingSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelBankingPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  const web3SpaceId =
    space.web3SpaceId != null && canConvertToBigInt(space.web3SpaceId)
      ? Number(space.web3SpaceId)
      : undefined;
  if (web3SpaceId === undefined) notFound();

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={slug}>
      <div className="flex w-full flex-col gap-4 py-4">
        <BankingSection spaceSlug={slug} web3SpaceId={web3SpaceId} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
