import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import {
  findSpaceBySlug,
  PIPELINE_SWIMLANES,
  type PipelineSwimlane,
} from '@hypha-platform/core/server';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { notFound, redirect } from 'next/navigation';
import { getDhoPathOverview } from '../../../overview/constants';
import { getDhoPathPipeline } from '../../constants';
import { PipelineTrackClient } from './pipeline-track-client';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; swimlane: string }>;
};

export default async function PipelineTrackPage(props: PageProps) {
  const params = await props.params;
  const { lang, id, swimlane: swimlaneRaw } = params;

  const swimlane = decodeURIComponent(swimlaneRaw) as PipelineSwimlane;
  if (!PIPELINE_SWIMLANES.includes(swimlane)) {
    notFound();
  }

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) {
    return notFound();
  }
  if (!spaceFromDb.pipelineEnabled) {
    redirect(getDhoPathOverview(lang, id));
  }

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb.web3SpaceId ?? undefined}
      spaceSlug={id}
    >
      <div className="flex flex-col gap-4 py-4">
        <PipelineTrackClient
          lang={lang}
          spaceSlug={id}
          swimlane={swimlane}
          boardHref={getDhoPathPipeline(lang, id)}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
