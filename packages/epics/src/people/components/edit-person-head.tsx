import { Skeleton } from '@hypha-platform/ui';
import { MemberType } from '@hypha-platform/graphql/rsc';
import { Image } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';

export type EditPersonHeadProps = {
  isLoading?: boolean;
  nickname?: string;
};

export const EditPersonHead = ({
  name,
  surname,
  avatar,
  isLoading,
  nickname,
}: EditPersonHeadProps & MemberType) => {
  return (
    <div className="flex items-center">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={avatar || '/placeholder/space-avatar-image.png'}
          height={64}
          width={64}
          alt={name && surname ? `${name} ${surname}` : 'Person Avatar'}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
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
            <span className="flex items-center">
              <Text className="text-1 text-neutral-11">{nickname}</Text>
            </span>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
