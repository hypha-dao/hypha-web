import { Skeleton } from '@hypha-platform/ui';
import { EyeOpenIcon, ChatBubbleIcon } from '@radix-ui/react-icons';

export type ViewsAndCommentsProps = {
  views?: number;
  comments?: number;
  isLoading?: boolean;
};

export const ViewsAndComments = ({
  views,
  comments,
  isLoading,
}: ViewsAndCommentsProps) => (
  <div className="flex flex-grow gap-2 text-1 text-neutral-11 items-center">
    <Skeleton width="16px" height="16px" loading={isLoading}>
      <div className="flex">
        <EyeOpenIcon className="mr-1" width={16} />
        <div>{views}</div>
      </div>
    </Skeleton>
    <Skeleton width="16px" height="16px" loading={isLoading}>
      <div className="flex ml-3">
        <ChatBubbleIcon className="mr-1" width={16} />
        <div>{comments}</div>
      </div>
    </Skeleton>
  </div>
);
