import {
  SpaceEnergySection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';

import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelEnergyPage(
  props: WhiteLabelPageProps,
) {
  const { slug } = await props.params;
  const space = await getWhiteLabelSpace(slug);

  return (
    <SpaceTabAccessWrapper
      spaceId={space.web3SpaceId as number}
      spaceSlug={slug}
    >
      <div className="flex flex-col gap-6 py-4">
        {/* Explicit slug (#2622): nothing here reads the pathname. */}
        <SpaceEnergySection spaceSlug={slug} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
