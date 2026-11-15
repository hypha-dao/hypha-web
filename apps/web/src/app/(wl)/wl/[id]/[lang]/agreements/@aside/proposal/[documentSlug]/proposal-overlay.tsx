'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ProposalDetail,
  ProposalOverlayShell,
  resolveInviteLeadImage,
  useDbTokens,
} from '@hypha-platform/epics';
import {
  useProposalDetailsWeb3Rpc,
  useSpaceBySlug,
} from '@hypha-platform/core/client';

import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useMembers } from '@web/hooks/use-members';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/**
 * Proposal detail on a white-label tree: the shared `ProposalDetail` in the
 * overlay shell, read-only. `readOnly` (always, on every host, with or without
 * login) leaves out vote, withdraw, resubmit, the expire banner and the
 * discussion; the vote is a later step.
 */
export function ProposalOverlay() {
  const { id } = useParams();
  const sectionHref = useWhiteLabelSectionHref();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);
  const { proposalDetails, error: proposalError } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });
  // Keep the loading state while the on-chain details are on their way, so the
  // vote bars do not flash zero values (same rule as the main app's page).
  const isProposalDataPending =
    document?.web3ProposalId != null && !proposalDetails && !proposalError;
  const { space } = useSpaceBySlug(id as string);
  const { persons, spaces } = useMembers({
    spaceSlug: space?.slug as string,
    paginationDisabled: true,
  });
  const { tokens } = useDbTokens();
  const leadImage = useMemo(
    () =>
      resolveInviteLeadImage({
        leadImage: document?.leadImage,
        label: document?.label,
        title: document?.title,
        spaceLeadImage: space?.leadImage,
      }),
    [document?.leadImage, document?.label, document?.title, space?.leadImage],
  );

  return (
    <ProposalOverlayShell
      className={document?.label === 'Quest' ? 'md:max-w-[560px]' : undefined}
    >
      <ProposalDetail
        readOnly
        documentId={document?.id}
        membersForWhitelist={persons?.data}
        spacesForWhitelist={spaces?.data}
        closeUrl={sectionHref('agreements')}
        content={document?.description}
        creator={{
          id: document?.creator?.id ?? document?.creatorId,
          avatar: document?.creator?.avatarUrl || '',
          name: document?.creator?.name || '',
          surname: document?.creator?.surname || '',
          address: document?.creator?.address || '',
        }}
        title={document?.title}
        status={document?.state}
        isLoading={isLoading || isProposalDataPending}
        leadImage={leadImage}
        attachments={document?.attachments}
        proposalId={document?.web3ProposalId}
        web3SpaceId={space?.web3SpaceId ?? undefined}
        spaceSlug={space?.slug || ''}
        label={document?.label || ''}
        documentSlug={documentSlug}
        chatRoomId={document?.chatRoomId}
        chatRoomResolved={!isLoading}
        dbTokens={tokens || []}
      />
    </ProposalOverlayShell>
  );
}
