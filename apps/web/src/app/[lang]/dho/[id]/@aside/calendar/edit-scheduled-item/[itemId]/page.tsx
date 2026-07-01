import { ConnectedScheduledItemForm } from '@web/components/connected-scheduled-item-form';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { Locale } from '@hypha-platform/i18n';
import {
  findScheduledItemById,
  findSpaceBySlug,
  parseScheduledItemId,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { getDhoPathCalendar } from '@web/lib/dho-calendar-paths';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; itemId: string }>;
};

export default async function EditScheduledItemPage({ params }: PageProps) {
  const { lang, id, itemId } = await params;
  const parsedItemId = parseScheduledItemId(itemId);
  if (parsedItemId == null) notFound();

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const item = await findScheduledItemById({ id: parsedItemId }, { db });
  if (!item || item.spaceId !== spaceFromDb.id) notFound();

  const successfulUrl = getDhoPathCalendar(lang, id);

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
          successfulUrl={successfulUrl}
          closeUrl={successfulUrl}
          backUrl={successfulUrl}
          initialItem={item}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
