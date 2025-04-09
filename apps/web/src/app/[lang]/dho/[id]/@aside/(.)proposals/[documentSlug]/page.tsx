'use client';

import { ProposalDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';
import { getDhoPathAgreements } from '../../../agreements/constants';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';

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
