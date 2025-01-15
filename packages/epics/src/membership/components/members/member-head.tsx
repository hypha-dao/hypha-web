import { Skeleton, Image, Badge, StatusBadge } from "@hypha-platform/ui";
import { Text } from "@radix-ui/themes";

export type MemberHeadProps = {
  avatar?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  commitment?: number;
  status?: string;
  isLoading: boolean;
};

export const MemberHead = ({
  avatar,
  name,
  surname,
  nickname,
  commitment,
  status,
  isLoading,
}: MemberHeadProps) => {
  return (
    <div className="flex">
      <Skeleton
        width={'64px'}
        height={'64px'}
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
            <Text className="text-1 text-gray-500">@{nickname}</Text>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
