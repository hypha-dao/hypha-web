import { Card, Skeleton, Image } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/server';
import { Text } from '@radix-ui/themes';

export const SpaceMemberCard: React.FC<{
  space: Space;
  isLoading?: boolean;
}> = ({ space, isLoading }) => {
  return (
    <Card className="w-full h-full p-5 mb-2 flex">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="h-[64px] w-[64px] rounded-lg mr-3"
          src={space.logoUrl || '/placeholder/default-space.svg'}
          height={64}
          width={64}
          alt={space.title}
        />
      </Skeleton>
      <div className="flex flex-col justify-center">
        <Skeleton height="26px" width="160px" loading={isLoading}>
          <Text className="text-4">{space.title}</Text>
        </Skeleton>
        <Skeleton height="16px" width="120px" loading={isLoading}>
          <Text className="text-1 text-neutral-11">{space.description}</Text>
        </Skeleton>
      </div>
    </Card>
  );
};
