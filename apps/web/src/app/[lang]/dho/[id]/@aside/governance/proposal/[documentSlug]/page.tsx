'use client';

import {
  ProposalDetail,
  SidePanel,
  useSpaceDocumentsWithStatuses,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { useDbTokens } from '@web/hooks/use-db-tokens';
import {
  useVote,
  useJwt,
  useProposalDetailsWeb3Rpc,
  useSpaceBySlug,
  useMyVote,
} from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui';
import { useEffect, useState } from 'react';
import { Button } from '@hypha-platform/ui';
import { extractContractRevertReason } from '@hypha-platform/ui-utils';

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
    error: voteError,
    clearError,
    isVoting: isHookVoting,
    isCheckingExpiration,
    isDeletingToken,
  } = useVote({
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
  const [generalError, setGeneralError] = useState<string | null>(null);

  const voteAndRefresh = async (voteFn: () => Promise<unknown>) => {
    setIsVoting(true);
    setProgress(0);
    setVoteMessage('Processing vote...');
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
      setIsVoting(false);
    } catch (err) {
      console.error('Error during vote process:', err);
      setGeneralError(
        (err as Error).message ||
          'An error occurred while processing your vote.',
      );
      setProgress(100);
      setVoteMessage('Vote failed');
      setIsVoting(false);
    }
  };

  useEffect(() => {
    if (voteError || generalError) return;
    if (!isVoting) return;
    if (myVote !== null && !isLoadingProposal && !isLoading) {
      setIsVoting(false);
      setProgress(100);
      setVoteMessage('Vote processed!');
    }
  }, [isVoting, myVote, isLoading, isLoadingProposal, voteError, generalError]);

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

  const isBackdropLoading =
    isLoading ||
    isVoting ||
    !!voteError ||
    !!generalError ||
    isHookVoting ||
    isCheckingExpiration ||
    isDeletingToken;

  const displayError = voteError
    ? extractContractRevertReason(voteError.message)
    : generalError;

  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isBackdropLoading}
        message={
          displayError ? (
            <div className="flex flex-col">
              <div>{displayError}</div>
              <Button
                onClick={() => {
                  clearError();
                  setGeneralError(null);
                  setIsVoting(false);
                  setProgress(0);
                  setVoteMessage('Processing vote...');
                }}
              >
                Reset
              </Button>
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
          closeUrl={getDhoPathGovernance(lang as Locale, id as string)}
          onAccept={handleOnAccept}
          onReject={handleOnReject}
          onCheckProposalExpiration={handleOnCheckProposalExpiration}
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
