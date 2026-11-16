'use client';

import { TrackPage } from '@hypha-platform/epics';
import type { PipelineSwimlane } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { useWhiteLabelSectionHref } from './white-label-provider';

/**
 * Read-only track page: same rules as the board (no write controls, inert
 * deal cards). The back link is the section URL of this tree.
 */
export function WhiteLabelPipelineTrack({
  spaceSlug,
  swimlane,
}: {
  spaceSlug: string;
  swimlane: PipelineSwimlane;
}) {
  const sectionHref = useWhiteLabelSectionHref();
  return (
    <TrackPage
      readOnly
      spaceSlug={spaceSlug}
      swimlane={swimlane}
      boardHref={sectionHref('pipeline')}
      useMembers={useMembers}
    />
  );
}
