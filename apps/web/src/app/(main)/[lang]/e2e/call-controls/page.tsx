'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { HumanChatPanelCallReactPopover } from '@hypha-platform/epics';

/**
 * Dev-only harness for Playwright WCUX-REACT-4 popover checks.
 * Returns 404 in production builds.
 */
export default function E2eCallControlsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [localHandRaised, setLocalHandRaised] = useState(false);

  return (
    <main
      data-testid="e2e-call-controls-harness"
      className="flex min-h-[50vh] items-end justify-center p-8"
    >
      <HumanChatPanelCallReactPopover
        localHandRaised={localHandRaised}
        onSendReaction={() => {}}
        onToggleRaiseHand={() => {
          setLocalHandRaised((raised) => !raised);
        }}
      />
    </main>
  );
}
