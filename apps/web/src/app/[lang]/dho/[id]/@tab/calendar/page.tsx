import { SpaceCalendar, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CalendarPage(props: PageProps) {
  const params = await props.params;
  const { id } = params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) {
    return notFound();
  }

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb.web3SpaceId ?? undefined}
      spaceSlug={id}
    >
      <div className="flex min-h-0 flex-col py-2">
        <SpaceCalendar
          spaceSlug={id}
          spaceId={spaceFromDb.id}
          lang={params.lang}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
