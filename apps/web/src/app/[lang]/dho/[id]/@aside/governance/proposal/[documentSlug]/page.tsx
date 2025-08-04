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

export default function Agreements() {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading, mutate } = useDocumentBySlug(documentSlug);
  const {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isVoting,
  } = useVote({
    proposalId: document?.web3ProposalId,
  });
  const { space } = useSpaceBySlug(id as string);
  const { update } = useSpaceDocumentsWithStatuses({
    spaceSlug: space?.slug as string,
    spaceId: space?.web3SpaceId as number,
  });
  const { tokens } = useDbTokens();

  return (
    <SidePanel>
      <ProposalDetail
        closeUrl={getDhoPathGovernance(lang as Locale, id as string)}
        onAccept={handleAccept}
        onReject={handleReject}
        onCheckProposalExpiration={handleCheckProposalExpiration}
        updateProposalData={mutate}
        updateProposalsList={update}
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
    </SidePanel>
  );
}
