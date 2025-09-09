'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ButtonClose,
  FullVoterList,
  ProposalHead,
  SidePanel,
  ButtonBack,
  getDhoPathAgreements,
} from '@hypha-platform/epics';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useProposalDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { formatDate } from '@hypha-platform/ui-utils';
import { Separator } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';

export default function VotersOverlay() {
  const router = useRouter();
  const { documentSlug, lang, id } = useParams();
  const { document } = useDocumentBySlug(documentSlug as string);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: document?.web3ProposalId as number,
  });

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
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
            createDate={formatDate(proposalDetails?.startTime ?? new Date())}
          />
          <div className="flex justify-center gap-1">
            <ButtonBack
              label="Back"
              backUrl={`${getDhoPathAgreements(
                lang as Locale,
                id as string,
              )}/proposal/${document?.slug}`}
            />
            <ButtonClose
              closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
            />
          </div>
        </div>
        <Separator />
        <FullVoterList documentSlug={documentSlug as string} />
      </div>
    </SidePanel>
  );
}
