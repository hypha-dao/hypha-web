'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  ProposalDetail,
  ProposalOverlayShell,
  resolveInviteLeadImage,
  useDbTokens,
  useSpaceDocumentsWithStatuses,
} from '@hypha-platform/epics';
import {
  extractRevertReason,
  useJwt,
  useMyVote,
  useProposalDetailsWeb3Rpc,
  useSpaceBySlug,
  useVote,
} from '@hypha-platform/core/client';
import { Button, LoadingBackdrop } from '@hypha-platform/ui';

import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/** Reason text of a failed transaction (same parsing as the main app's page). */
function parseRevertReason(
  error: unknown,
  unknownTransactionReason: string,
  unknownError: string,
): string {
  const raw =
    typeof error === 'string'
      ? error
      : (error as { message?: unknown })?.message;
  const message = typeof raw === 'string' ? raw : '';
  const start = message.indexOf('Execution reverted with reason:');
  const end = message.indexOf('Request Arguments');
  if (start !== -1) {
    const reasonStart = start + 'Execution reverted with reason:'.length;
    const reason =
      end !== -1
        ? message.substring(reasonStart, end).trim()
        : message.substring(reasonStart).trim();
    return extractRevertReason(reason) || unknownTransactionReason;
  }
  return message || unknownError;
}

/**
 * Proposal detail on a white-label tree: the shared `ProposalDetail` in the
 * overlay shell. `readOnly` (always, on every host) leaves out resubmit and the
 * discussion; vote, expire and withdraw come back only where the `vote`
 * capability is live (a host with login), through the same `useVote` flow as
 * the main app's page. Without login the handlers are never reachable.
 */
export function ProposalOverlay() {
  const { id } = useParams();
  const sectionHref = useWhiteLabelSectionHref();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);
  const {
    proposalDetails,
    error: proposalError,
    refreshUntilVoteApplied,
  } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });
  // Keep the loading state while the on-chain details are on their way, so the
  // vote bars do not flash zero values (same rule as the main app's page).
  const isProposalDataPending =
    document?.web3ProposalId != null && !proposalDetails && !proposalError;
  const { space } = useSpaceBySlug(id as string);
  const { tokens } = useDbTokens();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { jwt: authToken } = useJwt();
  const { mutate: votersMutate } = useMyVote(documentSlug);
  const { update } = useSpaceDocumentsWithStatuses({
    spaceSlug: space?.slug as string,
    spaceId: space?.web3SpaceId as number,
    order: PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  });
  const {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isCheckingExpiration,
  } = useVote({
    documentId: document?.id,
    proposalId: document?.web3ProposalId,
    authToken,
    tokenSymbol: proposalDetails?.tokens[0]?.symbol,
  });
  const [isVoting, setIsVoting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voteMessage, setVoteMessage] = useState(
    tAgreementFlow('proposalLoader.processingVote'),
  );
  const [voteError, setVoteError] = useState<string | null>(null);

  const voteAndRefresh = async (voteFn: () => Promise<unknown>) => {
    setIsVoting(true);
    setProgress(0);
    setVoteMessage(tAgreementFlow('proposalLoader.processingVote'));
    setVoteError(null);
    try {
      await voteFn();
      setProgress(25);
      setVoteMessage(tAgreementFlow('proposalLoader.savingVote'));
      await update();
      setProgress(70);
      setVoteMessage(tAgreementFlow('proposalLoader.gettingUpdatedData'));
      await Promise.all([votersMutate(), refreshUntilVoteApplied()]);
      setProgress(100);
      setVoteMessage(tAgreementFlow('proposalLoader.voteProcessed'));
    } catch (err) {
      const parsed = parseRevertReason(
        err,
        tAgreementFlow('proposalLoader.transactionRevertedUnknownReason'),
        tAgreementFlow('proposalLoader.unknownErrorOccurred'),
      );
      console.error('Error during vote process:', parsed);
      setProgress(70);
      setVoteMessage(tAgreementFlow('proposalLoader.somethingWentWrong'));
      setVoteError(parsed);
    } finally {
      setIsVoting(false);
    }
  };

  const handleCheckExpiration = async () => {
    try {
      await handleCheckProposalExpiration();
      await update();
    } catch (err) {
      console.debug(err);
    }
  };
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
    <ProposalOverlayShell>
      <LoadingBackdrop
        progress={progress}
        isLoading={isVoting || !!voteError}
        message={
          voteError ? (
            <div className="text-center space-y-2">
              <div className="text-error-9 font-medium ml-6 mr-6">
                {voteError}
              </div>
              <Button
                onClick={() => {
                  setVoteError(null);
                  setProgress(0);
                  setVoteMessage('');
                }}
                className="rounded-lg justify-start text-white w-fit"
              >
                {tAgreementFlow('proposalLoader.retry')}
              </Button>
            </div>
          ) : (
            <span>{voteMessage}</span>
          )
        }
        className="-m-4 lg:-m-7"
      >
        <ProposalDetail
          readOnly
          onAccept={() => voteAndRefresh(handleAccept)}
          onReject={() => voteAndRefresh(handleReject)}
          onCheckProposalExpiration={handleCheckExpiration}
          isCheckingExpiration={isCheckingExpiration}
          isVoting={isVoting}
          onWithdrawSuccess={async () => {
            await update();
          }}
          documentId={document?.id}
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
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
