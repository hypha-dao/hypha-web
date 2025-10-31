'use client';

import {
  ProposalDetail,
  SidePanel,
  useSpaceDocumentsWithStatuses,
  useDbTokens,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
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
} from '@hypha-platform/core/client';
import { LoadingBackdrop, Button } from '@hypha-platform/ui';
import { useEffect, useState } from 'react';

export default function Agreements() {
  const { jwt: authToken } = useJwt();
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);
  const { proposalDetails, isLoading: isLoadingProposal } =
    useProposalDetailsWeb3Rpc({
      proposalId: document?.web3ProposalId as number,
    });
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
  const { update } = useSpaceDocumentsWithStatuses({
    spaceSlug: space?.slug as string,
    spaceId: space?.web3SpaceId as number,
  });
  const { tokens } = useDbTokens();
  const [isVoting, setIsVoting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voteMessage, setVoteMessage] = useState('Processing vote...');
  const [voteError, setVoteError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  function parseRevertReason(error: unknown): string {
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
      return reason || 'Transaction reverted for unknown reason.';
    }
    return message || 'An unknown error occurred.';
  }

  const voteAndRefresh = async (voteFn: () => Promise<unknown>) => {
    setIsVoting(true);
    setProgress(0);
    setVoteMessage('Processing vote...');
    setVoteError(null);
    setCanRetry(false);

    try {
      const txHash = await voteFn();
      setProgress(25);
      setVoteMessage('Saving vote...');
      await update();
      setProgress(70);
      setVoteMessage('Getting updated data...');
      await votersMutate();
      setProgress(100);
      setVoteMessage('Vote processed!');
    } catch (err: any) {
      const parsedMessage = parseRevertReason(err);
      console.error('Error during vote process:', parsedMessage);
      setProgress(70);
      setVoteMessage('Something went wrong.');
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
      setVoteMessage('Vote processed!');
    }
  }, [myVote, votersMutate, isLoading, isLoadingProposal]);

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
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isLoading || isVoting || !!voteError}
        message={
          voteError ? (
            <div className="text-center space-y-2">
              <div className="text-error-9 font-medium">{voteError}</div>
              {canRetry && (
                <Button
                  onClick={() => {
                    setVoteError(null);
                    setProgress(0);
                    setVoteMessage('');
                  }}
                  className="rounded-lg justify-start text-white w-fit"
                >
                  Retry
                </Button>
              )}
            </div>
          ) : isLoading ? (
            <span>Please wait...</span>
          ) : (
            <span>{voteMessage}</span>
          )
        }
        className="-m-4 lg:-m-7"
      >
        <ProposalDetail
          documentId={document?.id}
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
          }}
          title={document?.title}
          status={document?.state}
          isLoading={isLoading}
          leadImage={document?.leadImage}
          attachments={document?.attachments}
          proposalId={document?.web3ProposalId}
          spaceSlug={space?.slug || ''}
          label={document?.label || ''}
          documentSlug={documentSlug}
          dbTokens={tokens || []}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
