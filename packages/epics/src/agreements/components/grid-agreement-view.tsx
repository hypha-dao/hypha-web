import {
  Badge,
  Skeleton,
  StatusBadge,
  CardContent,
  CardTitle,
} from '@hypha-platform/ui';
import { CreatorInfo } from '../../common';
import { ViewsAndComments } from '../../common/views-and-comments';
import { AgreementCardProps } from './agreement-card';

export const GridAgreementView = ({
  commitment,
  status,
  title,
  creator,
  views,
  comments,
  isLoading,
  description,
}: AgreementCardProps) => (
  <CardContent className="pt-5 relative">
    <div className="flex gap-x-1 mb-2">
      <Badge isLoading={isLoading} variant="solid" colorVariant="accent">
        Agreement
      </Badge>
      <Badge isLoading={isLoading} variant="outline" colorVariant="accent">
        {commitment}%
      </Badge>
      <StatusBadge status={status} isLoading={isLoading} />
    </div>
    <div className="flex flex-col items-start mb-4">
      <Skeleton width="120px" height="18px" loading={isLoading}>
        <CardTitle>{title}</CardTitle>
      </Skeleton>
      <CreatorInfo creator={creator} isLoading={isLoading} />
    </div>
    <div className="flex flex-grow text-1 text-neutral-11 mb-4">
      <Skeleton width="200px" height="48px" loading={isLoading}>
        <div className="line-clamp-2">{description}</div>
      </Skeleton>
    </div>
    <ViewsAndComments
      views={views}
      comments={comments?.length}
      isLoading={isLoading}
    />
  </CardContent>
);
