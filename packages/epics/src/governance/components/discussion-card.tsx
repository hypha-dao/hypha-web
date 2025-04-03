import { Card, Skeleton, Image } from '@hypha-platform/ui';
import { DiscussionCardHead, Space, Creator } from './discussion-card-head';
import { DocumentLikeButton } from './document-like-button';
import { DocumentCommentButton } from './document-comment-button';
import { DocumentShareButton } from './document-share-button';
import { MarkdownSuspense } from '@hypha-platform/ui/server';

type DiscussionCardProps = {
  description: string;
  leadImageUrl: string;
  space: Space;
  creator: Creator;
  publicationDate: Date;
  isLoading?: boolean;
  replies: number;
  likes: number;
};

export const DiscussionCard = ({
  leadImageUrl,
  space,
  creator,
  publicationDate,
  description,
  isLoading,
  replies,
  likes,
}: DiscussionCardProps) => {
  return (
    <Card className="w-full">
      <div className="p-4 space-y-3">
        <DiscussionCardHead
          space={space}
          creator={creator}
          publicationDate={publicationDate}
          isLoading={isLoading}
        />
        <div className="w-full h-full">
          <Skeleton
            width="100%"
            height={32}
            loading={isLoading}
            className="w-full h-full"
          >
            <span className="text-1 text-neutral-11">
              <MarkdownSuspense content={description || ''}/>
            </span>
          </Skeleton>
        </div>
      </div>
      <Skeleton
        width="100%"
        height={360}
        loading={isLoading}
        className="w-full h-[360px] object-cover"
      >
        <Image
          src={leadImageUrl || 'placeholder/space-lead-image.png'}
          alt={`Lead image for ${space.title}`}
          width={762}
          height={360}
          className="w-full h-[360px] object-cover"
        />
      </Skeleton>
      <div className="p-4 flex justify-between">
        <div className="flex items-center justify-between gap-x-5">
          <DocumentLikeButton isLoading={isLoading} />
          <DocumentCommentButton isLoading={isLoading} />
          <DocumentShareButton isLoading={isLoading} />
        </div>
        <div className="flex items-center justify-between gap-x-2">
          <Skeleton width={54} height={16} loading={isLoading}>
            <span className="text-1 text-neutral-11">{replies} replies</span>
          </Skeleton>
          <Skeleton width={54} height={16} loading={isLoading}>
            <span className="text-1 text-neutral-11">{likes} likes</span>
          </Skeleton>
        </div>
      </div>
    </Card>
  );
};
