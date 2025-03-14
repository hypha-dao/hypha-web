'use client';

import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';
import { useDocumentSlug } from '@web/hooks/use-document-slug';
import { useDocumentBySlug } from '@web/hooks/use-document-by-slug';
import { getDhoPathAgreements } from '../../agreements/constants';
import { useDiscussionByDocumentSlug } from '@web/hooks/use-discussion-by-document-slug';
import { DocumentDetailsHead } from 'packages/epics/src/governance/components/document-details-head';
import { Button, Skeleton, Image } from '@hypha-platform/ui';
import Link from 'next/link';
import { RxCross1 } from 'react-icons/rx';
import { MagicWandIcon } from '@radix-ui/react-icons';
import { Chat } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Agreements(props: PageProps) {
  const { id, lang } = useParams();
  const documentSlug = useDocumentSlug();
  const { discussion } = useDiscussionByDocumentSlug(documentSlug);
  const { document, isLoading } = useDocumentBySlug(documentSlug);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <DocumentDetailsHead
          creator={{
            avatarUrl:
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
            name: 'Jane',
            surname: 'Doe',
          }}
          title={document?.title}
          isLoading={isLoading}
          badges={[
            {
              label: 'discussion',
              className: 'capitalize',
              variant: 'solid',
              colorVariant: 'accent',
            },
          ]}
        />
        <Link
          href={getDhoPathAgreements(lang as Locale, id as string)}
          scroll={false}
        >
          <Button
            variant="ghost"
            colorVariant="neutral"
            className="flex items-center"
          >
            Close
            <RxCross1 className="ml-2" />
          </Button>
        </Link>
      </div>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Image
          height={100}
          width={554}
          className="w-full object-cover rounded-lg max-h-[100px]"
          src={'/placeholder/space-lead-image.png'}
          alt={document?.title ?? ''}
        />
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <div className="text-2 text-neutral-11">{document?.description}</div>
      </Skeleton>
      <div className="flex w-full justify-end">
        <Skeleton
          width="200px"
          height="35px"
          loading={isLoading}
          className="rounded-lg"
        >
          <Button colorVariant="accent">
            <MagicWandIcon width={16} height={16} className="mr-2" />
            Generate AI Summary
          </Button>
        </Skeleton>
      </div>
      <Chat messages={discussion || []} isLoading={isLoading} />
    </div>
  );
}
