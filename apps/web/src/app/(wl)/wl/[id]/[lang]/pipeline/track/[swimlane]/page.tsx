import { notFound } from 'next/navigation';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import {
  readPipelineConfig,
  type PipelineSwimlane,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { WhiteLabelPipelineTrack } from '@web/components/white-label/pipeline-track';
import { getWhiteLabelSpace } from '../../../../../../_lib/space';

type PageProps = {
  params: Promise<{ id: string; lang: string; swimlane: string }>;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * One track of the pipeline, read-only. Same checks as the main app's page:
 * the pipeline must be on for the Space and the track must be configured
 * (both otherwise the white-label 404). The data routes are member-gated.
 */
export default async function WhiteLabelPipelineTrackPage(props: PageProps) {
  const { id: slug, swimlane: swimlaneRaw } = await props.params;
  const swimlane = safeDecode(swimlaneRaw) as PipelineSwimlane;

  const space = await getWhiteLabelSpace(slug);
  if (!space.pipelineEnabled) notFound();

  const config = await readPipelineConfig({ spaceId: space.id }, { db });
  if (!config.tracks.some((track) => track.slug === swimlane)) notFound();

  return (
    <SpaceTabAccessWrapper
      spaceId={space.web3SpaceId ?? undefined}
      spaceSlug={slug}
    >
      <div className="flex min-w-0 flex-col gap-4 py-4">
        <WhiteLabelPipelineTrack spaceSlug={slug} swimlane={swimlane} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
