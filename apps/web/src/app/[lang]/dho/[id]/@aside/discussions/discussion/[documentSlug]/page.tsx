'use client';

import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { useDiscussionByDocumentSlug } from '@web/hooks/use-discussion-by-document-slug';

import { DocumentDetails, Chat, SidePanel } from '@hypha-platform/epics';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Agreements(props: PageProps) {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { discussion } = useDiscussionByDocumentSlug(documentSlug);
  const { document, isLoading } = useDocumentBySlug(documentSlug as string);

  return (
    <SidePanel>
      <DocumentDetails
        creator={{
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Jane',
          surname: 'Doe',
        }}
        title={document?.title}
        isLoading={isLoading}
        description={document?.description ?? ''}
        leadImage={'/placeholder/space-lead-image.png'}
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
        interactions={<Chat messages={discussion || []} />}
        badges={[
          {
            label: 'Discussion',
            variant: 'solid',
            colorVariant: 'accent',
          },
        ]}
      />
    </SidePanel>
  );
}
