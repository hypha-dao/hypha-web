'use client';

import { useParams } from 'next/navigation';
import {
  FullVoterList,
  ModalStickyNavigation,
  ProposalHead,
  ProposalOverlayShell,
  getDhoPathAgreements,
} from '@hypha-platform/epics';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';

export default function VotersOverlay() {
  const tModalAside = useTranslations('ModalAside');
  const { documentSlug, lang, id } = useParams();
  const { document } = useDocumentBySlug(documentSlug as string);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });

  const proposalShell = getDhoPathAgreements(lang as Locale, id as string);
  const backToProposal = `${proposalShell}/proposal/${
    document?.slug ?? (documentSlug as string)
  }`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('proposalVoters')}
          closeUrl={proposalShell}
          backUrl={backToProposal}
        />
        <div className="flex gap-5 justify-between">
          <ProposalHead
            creator={{
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
        <FullVoterList documentSlug={documentSlug as string} />
      </div>
    </ProposalOverlayShell>
  );
}
