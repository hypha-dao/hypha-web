'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CreateAgreementForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';

import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/**
 * Client side of the Collective agreement page. The form builds its return
 * URLs from props: they are host URLs here, never the main-app paths.
 */
export function CreateAgreementOverlay({
  spaceId,
  web3SpaceId,
}: {
  spaceId: number;
  web3SpaceId?: number;
}) {
  const { id } = useParams<{ id: string }>();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tModalAside = useTranslations('ModalAside');
  const sectionHref = useWhiteLabelSectionHref();
  const successfulUrl = sectionHref('agreements');
  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard spaceSlug={id} spaceId={web3SpaceId}>
        <CreateAgreementForm
          successfulUrl={successfulUrl}
          backUrl={sectionHref('agreements/select-create-action')}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
          label={tAgreementFlow('labels.collectiveAgreement')}
          stickyHeaderTitle={tModalAside('createProposal')}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
