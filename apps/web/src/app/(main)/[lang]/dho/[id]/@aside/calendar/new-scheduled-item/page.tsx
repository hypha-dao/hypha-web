import { ConnectedScheduledItemForm } from '@web/components/connected-scheduled-item-form';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { Locale } from '@hypha-platform/i18n';
import {
  findCoherenceById,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import {
  getDhoPathCalendar,
  parseScheduledItemDraftFromSearch,
} from '@web/lib/dho-calendar-paths';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewScheduledItemPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const query = await searchParams;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const draftRange = parseScheduledItemDraftFromSearch(query);
  const coherenceId = draftRange?.coherenceId;
  const linkedSignal =
    coherenceId != null
      ? await findCoherenceById({ id: coherenceId }, { db })
      : null;

  if (
    coherenceId != null &&
    (!linkedSignal ||
      linkedSignal.spaceId !== spaceFromDb.id ||
      !linkedSignal.title.trim())
  ) {
    notFound();
  }

  const successfulUrl = getDhoPathCalendar(lang, id);

  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <ConnectedScheduledItemForm
          mode="create"
          spaceId={spaceFromDb.id}
          spaceSlug={id}
          lang={lang}
          successfulUrl={successfulUrl}
          closeUrl={successfulUrl}
          backUrl={successfulUrl}
          draftRange={draftRange}
          linkedSignal={
            linkedSignal
              ? {
                  coherenceId: linkedSignal.id,
                  title: linkedSignal.title,
                  slug: linkedSignal.slug,
                }
              : null
          }
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
