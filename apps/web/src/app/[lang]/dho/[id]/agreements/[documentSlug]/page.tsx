'use client';

import { AgreementDetail } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { getDhoPathAgreements } from '../constants';
import { Locale } from '@hypha-platform/i18n';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Agreements(props: PageProps) {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { document, isLoading } = useDocumentBySlug(documentSlug as string);

  return (
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
  );
}
