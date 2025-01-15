import { Text } from '@radix-ui/themes';
import { Card, Badge, StatusBadge, Skeleton, Image } from '@hypha-platform/ui';
import { SewingPinFilledIcon } from '@radix-ui/react-icons';

export type MemberCardProps = {
  name?: string;
  surname?: string;
  nickname?: string;
  location?: string;
  avatar?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
  minimize?: boolean;
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
  minimize,
}) => {
  return (
    <Card className="w-full h-full p-5 mb-2 flex">
      <Skeleton
        width={minimize ? '40px' : '64px'}
        height={minimize ? '40px' : '64px'}
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={avatar ?? ''}
          height={minimize ? 40 : 64}
          width={minimize ? 40 : 64}
          alt={nickname ?? ''}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          {!minimize ? (
            <div className="flex gap-x-1">
              <Badge
                variant="surface"
                colorVariant="accent"
                isLoading={isLoading}
              >
                Recurring
              </Badge>
              <Badge
                variant="surface"
                colorVariant="accent"
                isLoading={isLoading}
              >
                {commitment}%
              </Badge>
              <StatusBadge isLoading={isLoading} status={status} />
            </div>
          ) : null}

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-4">
              {name} {surname}
            </Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-1 text-neutral-11">@{nickname}</Text>
          </Skeleton>
        </div>

        <Skeleton width="96px" height="16px" loading={isLoading}>
          <div className="flex h-full justify-end items-end text-neutral-11">
            <SewingPinFilledIcon className="mr-1" />
            <Text className="text-1">{location}</Text>
          </div>
        </Skeleton>
      </div>
    </Card>
  );
};
