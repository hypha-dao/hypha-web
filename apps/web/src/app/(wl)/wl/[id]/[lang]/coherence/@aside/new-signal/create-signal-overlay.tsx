'use client';

import { ProposalOverlayShell } from '@hypha-platform/epics';

import { ConnectedCreateSignalForm } from '@web/components/connected-create-signal-form';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';
import { useParams } from 'next/navigation';

/**
 * Client side of the create-signal page (a `'use client'` page file inside a
 * route group with parallel routes did not get its client manifest, see the
 * proposal overlay). After publishing or closing it returns to the section
 * with a host URL, never the main-app path the shared form would build.
 */
export function CreateSignalOverlay({
  spaceId,
  web3SpaceId,
}: {
  spaceId: number;
  web3SpaceId?: number;
}) {
  const { id } = useParams<{ id: string }>();
  const sectionHref = useWhiteLabelSectionHref();
  const back = sectionHref('coherence');
  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={web3SpaceId}
        closeUrl={back}
      >
        <ConnectedCreateSignalForm
          successfulUrl={back}
          closeUrl={back}
          backUrl={back}
          spaceId={spaceId}
          hideTagPeople
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
