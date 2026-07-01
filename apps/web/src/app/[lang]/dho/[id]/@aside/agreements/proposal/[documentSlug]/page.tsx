'use client';

import {
  ProposalDetail,
  ProposalOverlayShell,
  useSpaceDocumentsWithStatuses,
  PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  useDbTokens,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useMembers } from '@web/hooks/use-members';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  useVote,
  useJwt,
  useProposalDetailsWeb3Rpc,
  useSpaceBySlug,
  useMyVote,
  extractRevertReason,
} from '@hypha-platform/core/client';
import { LoadingBackdrop, Button } from '@hypha-platform/ui';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

function parseRevertReason(
  error: unknown,
  unknownTransactionReason: string,
  unknownError: string,
): string {
  const message =
    typeof error === 'string' ? error : (error as any)?.message || '';

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

export default function Agreements() {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { jwt: authToken } = useJwt();
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);
  const { proposalDetails, isLoading: isLoadingProposal } =
    useProposalDetailsWeb3Rpc({
      proposalId: document?.web3ProposalId as number,
    });
  // While the document says this is a proposal (has a web3ProposalId) but the
  // on-chain details haven't arrived yet, keep the detail view in its loading
  // state. Otherwise quorum/unity/vote bars briefly render as 0 and then jump
  // to their real values - the visible "flicker" when opening the modal.
  const isProposalDataPending =
    document?.web3ProposalId != null && !proposalDetails;
  const { mutate: votersMutate, myVote } = useMyVote(documentSlug);
  const {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isCheckingExpiration,
  } = useVote({
    documentId: document?.id,
    proposalId: document?.web3ProposalId,
    authToken: authToken,
    tokenSymbol: proposalDetails?.tokens[0]?.symbol,
  });
  const { space } = useSpaceBySlug(id as string);
  const { persons: resubmitPersons, spaces: resubmitSpaces } = useMembers({
    spaceSlug: space?.slug as string,
    paginationDisabled: true,
  });
  const { update } = useSpaceDocumentsWithStatuses({
    spaceSlug: space?.slug as string,
    spaceId: space?.web3SpaceId as number,
    order: PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  });
  const { tokens } = useDbTokens();
  const [isVoting, setIsVoting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voteMessage, setVoteMessage] = useState(
    tAgreementFlow('proposalLoader.processingVote'),
  );
  const [voteError, setVoteError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const voteAndRefresh = async (voteFn: () => Promise<unknown>) => {
    setIsVoting(true);
    setProgress(0);
    setVoteMessage(tAgreementFlow('proposalLoader.processingVote'));
    setVoteError(null);
    setCanRetry(false);

    try {
      await voteFn();
      setProgress(25);
      setVoteMessage(tAgreementFlow('proposalLoader.savingVote'));
      await update();
      setProgress(70);
      setVoteMessage(tAgreementFlow('proposalLoader.gettingUpdatedData'));
      await votersMutate();
      setProgress(100);
      setVoteMessage(tAgreementFlow('proposalLoader.voteProcessed'));
    } catch (err: any) {
      const parsedMessage = parseRevertReason(
        err,
        tAgreementFlow('proposalLoader.transactionRevertedUnknownReason'),
        tAgreementFlow('proposalLoader.unknownErrorOccurred'),
      );
      console.error('Error during vote process:', parsedMessage);
      setProgress(70);
      setVoteMessage(tAgreementFlow('proposalLoader.somethingWentWrong'));
      setVoteError(parsedMessage);
      setCanRetry(true);
    } finally {
      setIsVoting(false);
    }
  };

  useEffect(() => {
    if (myVote !== null && !isLoadingProposal && !isLoading) {
      setIsVoting(false);
      setProgress(100);
      setVoteMessage(tAgreementFlow('proposalLoader.voteProcessed'));
    }
  }, [myVote, votersMutate, isLoading, isLoadingProposal, tAgreementFlow]);

  const handleOnAccept = async () => voteAndRefresh(handleAccept);
  const handleOnReject = async () => voteAndRefresh(handleReject);

  const handleOnCheckProposalExpiration = async () => {
    try {
      await handleCheckProposalExpiration();
      await update();
    } catch (err) {
      console.debug(err);
    }
  };

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
              {canRetry && (
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
              )}
            </div>
          ) : isLoading ? (
            <span>{tAgreementFlow('proposalLoader.pleaseWait')}</span>
          ) : (
            <span>{voteMessage}</span>
          )
        }
        className="-m-4 lg:-m-7"
      >
        <ProposalDetail
          documentId={document?.id}
          membersForWhitelist={resubmitPersons?.data}
          spacesForWhitelist={resubmitSpaces?.data}
          closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
          onAccept={handleOnAccept}
          onReject={handleOnReject}
          onCheckProposalExpiration={handleOnCheckProposalExpiration}
          isCheckingExpiration={isCheckingExpiration}
          isVoting={isVoting}
          content={document?.description}
          creator={{
            avatar: document?.creator?.avatarUrl || '',
            name: document?.creator?.name || '',
            surname: document?.creator?.surname || '',
            address: document?.creator?.address || '',
          }}
          title={document?.title}
          status={document?.state}
          isLoading={isLoading || isProposalDataPending}
          leadImage={document?.leadImage}
          attachments={document?.attachments}
          proposalId={document?.web3ProposalId}
          web3SpaceId={space?.web3SpaceId ?? undefined}
          spaceSlug={space?.slug || ''}
          label={document?.label || ''}
          documentSlug={documentSlug}
          dbTokens={tokens || []}
          onWithdrawSuccess={async () => {
            await update();
          }}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
