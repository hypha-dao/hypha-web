import { notFound } from 'next/navigation';
import {
  SpaceMemorySection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { getEnableSpaceMemory } from '@hypha-platform/feature-flags';

import type { WhiteLabelPageProps } from '../../../../_lib/space';

export default async function WhiteLabelMemoryPage(props: WhiteLabelPageProps) {
  const { slug } = await props.params;
  if (!(await getEnableSpaceMemory())) notFound();

  return (
    <SpaceTabAccessWrapper spaceSlug={slug}>
      <div className="w-full min-w-0 py-4">
        <SpaceMemorySection spaceSlug={slug} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
