import {
  Skeleton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@hypha-platform/ui';
import { Image } from '@hypha-platform/ui';
import { PersonLabel } from '../../people/components/person-label';
import { type Creator } from '../../people/components/person-label';
import { type BadgeItem, BadgesList } from '@hypha-platform/ui';
import {
  formatDate,
  stripDescription,
  stripMarkdown,
} from '@hypha-platform/ui-utils';
import { DocumentStatus, useEvents } from '@hypha-platform/core/client';
import React from 'react';

interface Document {
  id?: number;
  title?: string;
  description?: string;
  createdAt?: Date;
  status?: DocumentStatus;
}

interface DocumentCardProps {
  isLoading: boolean;
  leadImage?: string;
  creator?: Creator;
  badges?: BadgeItem[];
  interactions?: React.ReactNode;
}

export const DocumentCard: React.FC<DocumentCardProps & Document> = ({
  id: documentId,
  title,
  description,
  isLoading,
  leadImage,
  creator,
  badges,
  interactions,
  createdAt,
  status,
}) => {
  const type = React.useMemo(() => {
    switch (status) {
      case 'accepted':
        return 'executeProposal';
      case 'rejected':
        return 'rejectProposal';
      default:
        return undefined;
    }
  }, [status]);
  const { events, isLoadingEvents } = useEvents({
    type,
    referenceEntity: 'document',
    referenceId: documentId,
  });
  const event = !isLoadingEvents && Array.isArray(events) ? events[0] : null;
  return (
    <Card className="h-full w-full space-y-5">
      <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
        <Skeleton
          loading={isLoading}
          className="min-w-full"
          height="150px"
          width="250px"
        >
          <Image
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={leadImage || '/placeholder/document-lead-image.webp'}
            alt={title || ''}
            width={250}
            height={150}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <BadgesList isLoading={isLoading} badges={badges ?? []} />
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle>{title}</CardTitle>
          </Skeleton>
          <PersonLabel isLoading={isLoading} creator={creator} />
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
            loading={isLoading}
          >
            <div className="line-clamp-3 w-full">
              {stripDescription(
                stripMarkdown(description, {
                  orderedListMarkers: false,
                  unorderedListMarkers: false,
                }),
              )}
            </div>
          </Skeleton>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
            loading={isLoading || isLoadingEvents}
          >
            {type === 'executeProposal' && event && (
              <>Accepted on {formatDate(event.createdAt, true)}</>
            )}
            {type === 'rejectProposal' && event && (
              <>Rejected on {formatDate(event.createdAt, true)}</>
            )}
            {!type && createdAt && (
              <>Created on {formatDate(createdAt, true)}</>
            )}
          </Skeleton>
        </div>
        {interactions}
      </CardContent>
    </Card>
  );
};
