'use client';

import { useParams } from 'next/navigation';
import {
  ButtonClose,
  FullVoterList,
  ProposalHead,
  ProposalOverlayShell,
  ButtonBack,
  getDhoPathAgreements,
} from '@hypha-platform/epics';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';

export default function VotersOverlay() {
  const tCommon = useTranslations('Common');
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
        <div className="sticky top-0 z-[5] -mx-4 border-b border-border bg-background-2 lg:-mx-7">
          <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-border px-4 lg:px-7">
            <ButtonBack
              label={tCommon('back')}
              backUrl={backToProposal}
              className="px-0 md:px-3 align-top"
            />
            <ButtonClose
              closeUrl={proposalShell}
              className="px-0 md:px-3 align-top"
            />
          </div>
        </div>
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
