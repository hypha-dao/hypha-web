'use client';

import { ProposalDetail, SidePanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { useVote } from '@hypha-platform/core/client';
import { useSpaceDocumentsWithStatuses } from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useDbTokens } from '@web/hooks/use-db-tokens';
import { useJwt } from '@hypha-platform/core/client';
import { useProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
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
  const {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isVoting,
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

  const [isBackdropVisible, setIsBackdropVisible] = useState(false);
  const handleOnAccept = async () => {
    try {
      await handleAccept();
      await mutate();
      await update();
    } catch (err) {
      console.debug(err);
      setIsBackdropVisible(false);
    }
  };

  const handleOnReject = async () => {
    try {
      await handleReject();
      await mutate();
      await update();
    } catch (err) {
      console.debug(err);
      setIsBackdropVisible(false);
    }
  };

  const handleOnCheckProposalExpiration = async () => {
    try {
      await handleCheckProposalExpiration();
      await mutate();
      await update();
    } catch (err) {
      console.debug(err);
      setIsBackdropVisible(false);
    }
  };

  return (
    <SidePanel>
      <LoadingBackdrop
        isLoading={isBackdropVisible || isLoading}
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
