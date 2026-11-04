import { ConnectedScheduledItemForm } from '@web/components/connected-scheduled-item-form';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCalendar } from '../../../../@tab/calendar/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  findScheduledItemById,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    tab: string;
    itemId: string;
  }>;
};

export default async function EditScheduledItemPage({ params }: PageProps) {
  const { lang, id, itemId: itemIdRaw } = await params;
  const itemId = Number.parseInt(itemIdRaw, 10);
  if (!Number.isFinite(itemId) || itemId <= 0) notFound();

  const [spaceFromDb, scheduledItem] = await Promise.all([
    findSpaceBySlug({ slug: id }, { db }),
    findScheduledItemById({ id: itemId }, { db }),
  ]);

  if (
    !spaceFromDb ||
    !scheduledItem ||
    scheduledItem.spaceId !== spaceFromDb.id
  ) {
    notFound();
  }

  const calendarUrl = getDhoPathCalendar(lang, id);

  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <ConnectedScheduledItemForm
          mode="edit"
          spaceId={spaceFromDb.id}
          spaceSlug={id}
          lang={lang}
          successfulUrl={calendarUrl}
          closeUrl={calendarUrl}
          backUrl={calendarUrl}
          initialItem={scheduledItem}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
