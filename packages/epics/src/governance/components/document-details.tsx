import {
  DocumentDetailsHead,
  DocumentDetailsHeadProps,
  Document,
} from '../../governance/components/document-details-head';
import { Button, Skeleton, Separator } from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Image } from '@hypha-platform/ui';
import Link from 'next/link';
import { MarkdownSuspense } from '@hypha-platform/ui/server';

type DocumentDetailsProps = Document &
  DocumentDetailsHeadProps & {
    leadImage: string;
    closeUrl: string;
    interactions?: React.ReactNode;
  };

export const DocumentDetails = ({
  creator,
  title,
  isLoading,
  description,
  leadImage,
  closeUrl,
  badges,
  interactions,
}: DocumentDetailsProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <DocumentDetailsHead
          creator={creator}
          title={title}
          isLoading={isLoading}
          badges={badges}
        />
        <Link href={closeUrl} scroll={false}>
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
      <Separator />
      <Skeleton
        width="100%"
        height="150px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Image
          height={150}
          width={554}
          className="w-full object-cover rounded-lg max-h-[150px]"
          src={leadImage}
          alt={title ?? ''}
        />
      </Skeleton>
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        
        <div className="text-2 text-white">
          <MarkdownSuspense content={description || ''} />
        </div>
      </Skeleton>
      <Separator />
      {interactions}
    </div>
  );
};
