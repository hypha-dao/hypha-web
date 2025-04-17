'use client';
import { AgreementDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../../@aside/_components/side-panel';
import { useParams } from 'next/navigation';
import { getDhoPathAgreements } from '../../constants';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useDocumentSlug } from '@web/hooks/use-document-slug';

export default function Agreements() {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug);

  return (
    <SidePanel>
      <AgreementDetail
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
        onSetActiveFilter={() => console.log('set active filter')}
        content={document?.description || ''}
        creator={{
          avatarUrl: document?.creator?.avatarUrl || '',
          name: document?.creator?.name || '',
          surname: document?.creator?.surname || '',
        }}
        title={document?.title}
        commitment={50}
        status={document?.state}
        isLoading={isLoading}
        comments={[
          {
            id: '1',
            comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
            author: {
              avatar: 'https://github.com/shadcn.png',
              name: 'Name',
              surname: 'Surname',
            },
            likes: 16,
          },
          {
            id: '2',
            comment:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
            author: {
              avatar: 'https://github.com/shadcn.png',
              name: 'Name',
              surname: 'Surname',
            },
            likes: 16,
          },
          {
            id: '3',
            comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
            author: {
              avatar: 'https://github.com/shadcn.png',
              name: 'Name',
              surname: 'Surname',
            },
            likes: 16,
          },
        ]}
      />
    </SidePanel>
  );
}
