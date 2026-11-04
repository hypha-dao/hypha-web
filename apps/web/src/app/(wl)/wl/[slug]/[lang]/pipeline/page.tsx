import { notFound } from 'next/navigation';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

import { WhiteLabelPipelineBoard } from '@web/components/white-label/pipeline-board';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelPipelinePage(
  props: WhiteLabelPageProps,
) {
  const { slug, lang } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  if (!space.pipelineEnabled) notFound();

  return (
    <SpaceTabAccessWrapper
      spaceId={space.web3SpaceId ?? undefined}
      spaceSlug={slug}
    >
      <div className="flex min-w-0 flex-col gap-4 py-4">
        <WhiteLabelPipelineBoard lang={lang as Locale} spaceSlug={slug} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
