'use client';

import { ProposalOverlayShell } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

// SPIKE: overlay shell positioning inside `(wl)`. Replaced by the real page.
export default function WhiteLabelProposalSpike() {
  const { documentSlug } = useParams();
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-4">
        <h2>Spike: {String(documentSlug)}</h2>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i}>Line {i}</p>
        ))}
      </div>
    </ProposalOverlayShell>
  );
}
