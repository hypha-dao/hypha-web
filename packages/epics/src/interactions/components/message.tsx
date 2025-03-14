import { Skeleton, Image, Separator } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';

export type CreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
};

export type MessageProps = {
  creator?: CreatorType;
  date?: string;
  message?: string;
  replies: MessageProps[];
  id?: string;
  isReply?: boolean;
  isLoading?: boolean;
};

export const Message = ({
  creator,
  date,
  message,
  replies,
  isLoading,
  isReply,
}: MessageProps) => {
  return (
    <div className="mt-4">
      <div className="flex flex-row">
        <div>
          <Skeleton
            width="24px"
            height="24px"
            loading={isLoading}
            className="rounded-lg mr-2"
          >
            <Image
              className="rounded-lg mr-2 max-h-[24px] min-h-[24px] min-w-[24px]"
              src={creator?.avatar ?? ''}
              height={24}
              width={24}
              alt={
                creator?.name && creator?.surname
                  ? `${creator.name} ${creator.surname}`
                  : 'Creator Avatar'
              }
            />
          </Skeleton>
        </div>
        <div className="flex flex-col ml-1">
          <div className="flex items-center text-1">
            <Skeleton
              width="54px"
              height="16px"
              loading={isLoading}
              className="rounded-lg mr-2"
            >
              <div className="font-medium text-primary">
                {creator?.name} {creator?.surname}
              </div>
            </Skeleton>
            <Skeleton
              width="54px"
              height="16px"
              loading={isLoading}
              className="rounded-lg mr-2"
            >
              <div className="ml-2 text-gray-600 font-normal">
                {formatDate(date ?? '')}
              </div>
            </Skeleton>
          </div>
          <Skeleton
            width="100%"
            height="12px"
            loading={isLoading}
            className="rounded-lg mr-2 mt-2"
          >
            <div className="text-gray-500 font-normal text-1 mt-1">
              {message}
            </div>
          </Skeleton>
        </div>
      </div>
      {replies.map((reply) => (
        <div key={reply.id as string} className="ml-4">
          <Message
            isReply
            replies={reply.replies}
            isLoading={isLoading}
            message={reply.message}
            creator={reply.creator}
            date={reply.date}
          />
        </div>
      ))}
      {isReply ? null : <Separator className="mt-4" />}
    </div>
  );
};
