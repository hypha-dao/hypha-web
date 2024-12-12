import { Text } from '@radix-ui/themes';
import { Card, Badge, StatusBadge, Skeleton } from '@hypha-platform/ui';
import Image from 'next/image';
import { SewingPinFilledIcon } from '@radix-ui/react-icons';

type MemberCardProps = {
  name?: string;
  surname?: string;
  nickname?: string;
  location?: string;
  avatar?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
};

export const MemberCard: React.FC<MemberCardProps> = ({
  name,
  surname,
  nickname,
  location,
  avatar,
  commitment,
  status,
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
          src={avatar ?? ''}
          height={64}
          width={64}
          alt={nickname ?? ''}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            <Skeleton width="auto" height="auto" loading={isLoading}>
              <Badge variant="actionOutline">Recurring</Badge>
            </Skeleton>
            <Skeleton width="auto" height="auto" loading={isLoading}>
              <Badge variant="actionOutline">{commitment}%</Badge>
            </Skeleton>
            <StatusBadge isLoading={isLoading} status={status} />
          </div>

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-3">
              {name} {surname}
            </Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-xs text-gray-500">@{nickname}</Text>
          </Skeleton>
        </div>

        <Skeleton width="96px" height="16px" loading={isLoading}>
          <div className="flex h-full justify-end items-end text-gray-500">
            <SewingPinFilledIcon className="mr-1" />
            <Text className="text-xs">{location}</Text>
          </div>
        </Skeleton>
      </div>
    </Card>
  );
};
