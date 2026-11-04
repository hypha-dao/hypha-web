'use client';

import { useRouter } from 'next/navigation';
import { IntegratedBoard } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';
import type { PipelineSwimlane } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { getDhoPathPipelineDeal, getDhoPathPipelineTrack } from './constants';

export function PipelineBoardClient({
  lang,
  spaceSlug,
  activeDealId,
}: {
  lang: Locale;
  spaceSlug: string;
  activeDealId?: number | null;
}) {
  const router = useRouter();

  return (
    <IntegratedBoard
      spaceSlug={spaceSlug}
      lang={lang}
      useMembers={useMembers}
      activeDealId={activeDealId}
      onDealOpen={(dealId) =>
        router.push(getDhoPathPipelineDeal(lang, spaceSlug, dealId))
      }
      getTrackHref={(swimlane: PipelineSwimlane) =>
        getDhoPathPipelineTrack(lang, spaceSlug, swimlane)
      }
    />
  );
}
