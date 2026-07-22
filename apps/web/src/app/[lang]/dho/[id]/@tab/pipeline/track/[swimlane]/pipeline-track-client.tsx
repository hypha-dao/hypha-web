'use client';

import { useRouter } from 'next/navigation';
import { TrackPage } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';
import type { PipelineSwimlane } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { getDhoPathPipelineDeal } from '../../constants';

export function PipelineTrackClient({
  lang,
  spaceSlug,
  swimlane,
  boardHref,
  activeDealId,
}: {
  lang: Locale;
  spaceSlug: string;
  swimlane: PipelineSwimlane;
  boardHref: string;
  activeDealId?: number | null;
}) {
  const router = useRouter();

  return (
    <TrackPage
      spaceSlug={spaceSlug}
      swimlane={swimlane}
      boardHref={boardHref}
      useMembers={useMembers}
      activeDealId={activeDealId}
      onDealOpen={(dealId) =>
        router.push(getDhoPathPipelineDeal(lang, spaceSlug, dealId))
      }
    />
  );
}
