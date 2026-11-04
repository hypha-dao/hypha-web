'use client';

import { IntegratedBoard } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';
import type { PipelineSwimlane } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';

/**
 * Read-only pipeline board. Deal detail and the per-track page are not served
 * in the white-label tree, so both open the full app in a new tab (the
 * main app can not be framed).
 */
export function WhiteLabelPipelineBoard({
  lang,
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  return (
    <IntegratedBoard
      spaceSlug={spaceSlug}
      lang={lang}
      useMembers={useMembers}
      onDealOpen={(dealId) =>
        window.open(
          `/${lang}/dho/${spaceSlug}/pipeline/deal/${dealId}`,
          '_blank',
          'noopener,noreferrer',
        )
      }
      getTrackHref={(swimlane: PipelineSwimlane) =>
        `/${lang}/dho/${spaceSlug}/pipeline/track/${swimlane}`
      }
    />
  );
}
