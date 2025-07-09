import { Skeleton, Image, StatusBadge } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';

export type MemberHeadProps = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  status?: string;
  isLoading: boolean;
};

export const MemberHead = ({
  avatarUrl,
  name,
  surname,
  nickname,
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
          src={avatarUrl || '/placeholder/default-profile.svg'}
          height={64}
          width={64}
          alt={nickname ?? ''}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
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
            <Text className="text-1 text-neutral-11">@{nickname}</Text>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
