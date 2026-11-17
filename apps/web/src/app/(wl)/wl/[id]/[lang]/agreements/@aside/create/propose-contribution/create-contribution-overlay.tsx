'use client';

import { useParams } from 'next/navigation';
import {
  CreateProposeAContributionForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';

import { Plugin } from '@web/app/(main)/[lang]/dho/[id]/_components/plugins';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/**
 * Client side of the Propose a contribution page. Return URLs are host URLs.
 * The recipient and token pickers read the Space's members and tokens through
 * the allowlisted, own-Space `/api` routes.
 */
export function CreateContributionOverlay({
  spaceId,
  web3SpaceId,
}: {
  spaceId: number;
  web3SpaceId?: number;
}) {
  const { id } = useParams<{ id: string }>();
  const sectionHref = useWhiteLabelSectionHref();
  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard spaceSlug={id} spaceId={web3SpaceId}>
        <CreateProposeAContributionForm
          successfulUrl={sectionHref('agreements')}
          backUrl={sectionHref('agreements/select-create-action')}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
          plugin={<Plugin name="propose-contribution" spaceSlug={id} />}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
