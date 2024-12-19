import { Text } from '@radix-ui/themes';
import { Card, Badge, Skeleton, StatusBadge } from '@hypha-platform/ui';
import { Image } from '@hypha-platform/ui';
import { EyeOpenIcon, ChatBubbleIcon } from '@radix-ui/react-icons';

type Creator = {
  avatar?: string;
  name?: string;
  surname?: string;
};

type AgreementCardProps = {
  creator?: Creator;
  title?: string;
  commitment?: number;
  status?: string;
  views?: number;
  comments?: number;
  isLoading?: boolean;
};

export const AgreementCard: React.FC<AgreementCardProps> = ({
  commitment,
  status,
  title,
  creator,
  views,
  comments,
  isLoading,
}) => {
  return (
    <Card className="w-full h-full p-6 mb-2 flex">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={creator?.avatar ?? ''}
          height={64}
          width={64}
          alt={
            creator?.name && creator?.surname
              ? `${creator.name} ${creator.surname}`
              : 'Creator Avatar'
          }
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            <Badge isLoading={isLoading}>Agreement</Badge>
            <Badge isLoading={isLoading} variant="actionOutline">
              Recurring
            </Badge>
            <Badge isLoading={isLoading} variant="actionOutline">
              {commitment}%
            </Badge>
            <StatusBadge status={status} isLoading={isLoading} />
          </div>

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-3">{title}</Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-xs text-gray-500">
              {creator?.name} {creator?.surname}
            </Text>
          </Skeleton>
        </div>

        <div className="flex flex-grow gap-2 text-xs text-gray-500 items-end justify-end h-full">
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
      </div>
    </Card>
  );
};
