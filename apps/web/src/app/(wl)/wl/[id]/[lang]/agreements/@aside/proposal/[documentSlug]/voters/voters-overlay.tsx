'use client';

import { useTranslations } from 'next-intl';
import {
  FullVoterList,
  ModalStickyNavigation,
  ProposalHead,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { useProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';

import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/**
 * Voters of a proposal on a white-label tree: the same list as the main app,
 * which is read-only already. Close returns to the list, back to the proposal;
 * both stay on the host (or in the frame).
 */
export function VotersOverlay() {
  const tModalAside = useTranslations('ModalAside');
  const sectionHref = useWhiteLabelSectionHref();
  const documentSlug = useDocumentSlug();
  const { document } = useDocumentBySlug(documentSlug);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });

  const closeUrl = sectionHref('agreements');
  const backUrl = `${closeUrl}/proposal/${document?.slug ?? documentSlug}`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('proposalVoters')}
          closeUrl={closeUrl}
          backUrl={backUrl}
        />
        <div className="flex gap-5 justify-between">
          <ProposalHead
            creator={{
              id: document?.creator?.id ?? document?.creatorId,
              avatar: document?.creator?.avatarUrl || '',
              name: document?.creator?.name || '',
              surname: document?.creator?.surname || '',
            }}
            title={document?.title}
            status={document?.state}
            label={document?.label || ''}
            createDate={
              proposalDetails?.startTime
                ? new Date(proposalDetails.startTime)
                : undefined
            }
          />
        </div>
        <Separator />
        <FullVoterList documentSlug={documentSlug} />
      </div>
    </ProposalOverlayShell>
  );
}
