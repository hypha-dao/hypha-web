import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { notFound, redirect } from 'next/navigation';
import { getDhoPathOverview } from '../overview/constants';
import { PipelineBoardClient } from './pipeline-board-client';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function PipelinePage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;

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
        <PipelineBoardClient lang={lang} spaceSlug={id} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
