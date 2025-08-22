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
import { useState } from 'react';

export default function Agreements() {
  const { jwt: authToken } = useJwt();
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading, mutate } = useDocumentBySlug(documentSlug);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });
  const { mutate: votersMutate } = useMyVote(documentSlug);
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

  const handleOnAccept = async () => {
    try {
      setIsVoting(true);
      await handleAccept();
      await Promise.all([mutate(), update(), votersMutate()]);
    } catch (err) {
      setIsVoting(false);
      console.debug(err);
    } finally {
      setIsVoting(false);
    }
  };

  const handleOnReject = async () => {
    try {
      setIsVoting(true);
      await handleReject();
      await Promise.all([mutate(), update(), votersMutate()]);
    } catch (err) {
      setIsVoting(false);
      console.debug(err);
    } finally {
      setIsVoting(false);
    }
  };

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
        isLoading={isLoading}
        message={<span>Please wait...</span>}
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
