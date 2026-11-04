import { ConnectedScheduledItemForm } from '@web/components/connected-scheduled-item-form';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCalendar } from '../../../@tab/calendar/constants';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{
    startsAt?: string | string[];
    endsAt?: string | string[];
    allDay?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function parseDraftRange(searchParams: {
  startsAt?: string | string[];
  endsAt?: string | string[];
  allDay?: string | string[];
}) {
  const startsAtRaw = readSearchParam(searchParams.startsAt);
  const endsAtRaw = readSearchParam(searchParams.endsAt);
  const allDayRaw = readSearchParam(searchParams.allDay);

  if (!startsAtRaw || !endsAtRaw) return null;

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }

  return {
    startsAt,
    endsAt,
    allDay: allDayRaw === '1' || allDayRaw === 'true',
  };
}

export default async function NewScheduledItemPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const resolvedSearchParams = await searchParams;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const calendarUrl = getDhoPathCalendar(lang, id);
  const draftRange = parseDraftRange(resolvedSearchParams);

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
          successfulUrl={calendarUrl}
          closeUrl={calendarUrl}
          backUrl={calendarUrl}
          draftRange={draftRange}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
