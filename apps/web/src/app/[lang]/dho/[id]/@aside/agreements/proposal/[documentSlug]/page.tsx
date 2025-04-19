'use client';

import { ProposalDetail, SidePanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';

export default function Agreements() {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);

  return (
    <SidePanel>
      <ProposalDetail
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
        onAccept={() => console.log('accept')}
        onReject={() => console.log('reject')}
        onSetActiveFilter={() => console.log('set active filter')}
        content={document?.description}
        creator={{
          avatar: document?.creator?.avatarUrl || '',
          name: document?.creator?.name || '',
          surname: document?.creator?.surname || '',
        }}
        title={document?.title}
        status={document?.state}
        isLoading={isLoading}
      />
    </SidePanel>
  );
}
