import { notFound } from 'next/navigation';
import {
  EnergyScreen,
  EnergySectionSkeleton,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';

import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelEnergyPage(props: WhiteLabelPageProps) {
  const { id: slug } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) notFound();

  return (
    <SpaceTabAccessWrapper
      spaceId={web3SpaceId}
      spaceSlug={slug}
      pendingFallback={
        <div className="flex flex-col gap-6 py-4">
          <EnergySectionSkeleton />
        </div>
      }
    >
      <div className="flex flex-col gap-6 py-4">
        {/* Explicit slug (#2622): nothing here reads the pathname. */}
        <EnergyScreen spaceSlug={slug} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
