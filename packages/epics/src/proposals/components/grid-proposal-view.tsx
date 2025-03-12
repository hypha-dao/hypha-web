import { Card, Badge, Image, CardTitle, Skeleton } from '@hypha-platform/ui';
import { CreatorInfo } from './creator-info';
import { VoteButton } from './vote-button';
import { ProposalCardProps } from './proposal-card';
import { CardHeader, CardContent } from '@hypha-platform/ui';

export const GridProposalView = ({
  commitment,
  status,
  title,
  creator,
  isLoading,
  leadImage,
  description,
}: ProposalCardProps) => (
  <Card className="h-full w-full">
    <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
      <Skeleton loading={isLoading} height="150px" width="250px">
        <Image
          className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
          src={leadImage || '/placeholder/space-lead-image.png'}
          alt={title || 'TODO: make sure there is a title'}
          width={250}
          height={150}
        />
      </Skeleton>
    </CardHeader>
    <CardContent className="pt-5 relative">
      <div className="flex gap-x-1 mb-2">
        <Badge isLoading={isLoading} variant="solid" colorVariant="accent">
          Proposal
        </Badge>
        <Badge isLoading={isLoading} variant="outline" colorVariant="accent">
          {commitment}%
        </Badge>
        <Badge isLoading={isLoading} variant="outline" colorVariant="warn">
          On voting
        </Badge>
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
      <VoteButton isLoading={isLoading} isVoted={false} />
    </CardContent>
  </Card>
);
