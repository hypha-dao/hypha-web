'use client';

import { IntegratedBoard } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';
import type { PipelineSwimlane } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';

/**
 * Read-only pipeline board: no new-deal controls, no saved views, no drag and
 * drop, and inert deal cards (the deal page is not served; visitors are not
 * sent to the full app by default). The lane's "Open track" link is a plain
 * anchor, mapped by the link guard to the served track page.
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
      readOnly
      spaceSlug={spaceSlug}
      lang={lang}
      useMembers={useMembers}
      getTrackHref={(swimlane: PipelineSwimlane) =>
        `/${lang}/dho/${spaceSlug}/pipeline/track/${encodeURIComponent(
          swimlane,
        )}`
      }
    />
  );
}
