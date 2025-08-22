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

export default function Agreements() {
  const { jwt: authToken } = useJwt();
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading, mutate } = useDocumentBySlug(documentSlug);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });
  const { mutate: votersMutate, myVote } = useMyVote(documentSlug);
  const { handleAccept, handleReject, handleCheckProposalExpiration } = useVote(
    {
      proposalId: document?.web3ProposalId,
      authToken: authToken,
      tokenSymbol: proposalDetails?.tokens[0]?.symbol,
    },
  );
  const { space } = useSpaceBySlug(id as string);
  const { update } = useSpaceDocumentsWithStatuses({
    spaceSlug: space?.slug as string,
    spaceId: space?.web3SpaceId as number,
  });
  const { tokens } = useDbTokens();
  const [isVoting, setIsVoting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voteMessage, setVoteMessage] = useState('Processing vote...');

  const voteAndRefresh = async (voteFn: () => Promise<unknown>) => {
    setIsVoting(true);
    setProgress(0);
    setVoteMessage('Processing vote...');
    try {
      const txHash = await voteFn();
      setProgress(25);
      setVoteMessage('Saving vote...');
      await Promise.all([mutate(), update(), votersMutate()]);
      setProgress(70);
      setVoteMessage('Getting updated data...');
    } catch (err) {
      console.debug(err);
      setProgress(0);
      setVoteMessage('Processing vote...');
    }
  };

  useEffect(() => {
    if (myVote) {
      setIsVoting(false);
      setProgress(100);
      setVoteMessage('Vote processed!');
    }
  }, [myVote]);

  const handleOnAccept = async () => voteAndRefresh(handleAccept);
  const handleOnReject = async () => voteAndRefresh(handleReject);

  const handleOnCheckProposalExpiration = async () => {
    try {
      await handleCheckProposalExpiration();
      await mutate();
      await update();
    } catch (err) {
      console.debug(err);
    }
  };

  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isLoading || isVoting}
        message={
          isLoading ? <span>Please wait...</span> : <span>{voteMessage}</span>
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
