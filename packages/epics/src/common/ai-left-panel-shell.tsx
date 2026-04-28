'use client';

import { SpaceLeftNav } from './space-left-nav';
import { AiLeftPanel } from './ai-left-panel';

/**
 * Left sidebar slot for space routes: space navigation rail above the AI chat panel.
 * Mount only when AI chat is enabled and {@link useIsSpaceContext} applies (handled by caller).
 */
export function AiLeftPanelShell({
  coherenceEnabled,
}: {
  coherenceEnabled: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <SpaceLeftNav coherenceEnabled={coherenceEnabled} />
      <div className="flex min-h-0 flex-1 flex-col bg-background-2">
        <AiLeftPanel />
      </div>
    </div>
  );
}
