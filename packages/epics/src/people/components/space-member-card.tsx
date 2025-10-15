'use client';

import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/server';
import { Text } from '@radix-ui/themes';
import { useSpaceDelegate } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { formatDate } from '@hypha-platform/ui-utils';

export const SpaceMemberCard: React.FC<{
  space: Space;
  isLoading?: boolean;
}> = ({ space, isLoading }) => {
  const { id: spaceSlug } = useParams();
  const { space: currentSpace } = useSpaceBySlug(spaceSlug as string);
  const { person: delegator } = useSpaceDelegate({
    user: space?.address as `0x${string}`,
    spaceId: currentSpace?.web3SpaceId as number,
  });

  return (
    <Card className="w-full h-full p-5 mb-2 flex gap-5 flex-col">
      <div className="flex gap-3">
        <Skeleton
          width="64px"
          height="64px"
          loading={isLoading}
          className="rounded-lg"
        >
          <Image
            className="h-[64px] w-[64px] rounded-lg"
            src={space.logoUrl || '/placeholder/default-space.svg'}
            height={64}
            width={64}
            alt={space.title}
          />
        </Skeleton>
        <div className="flex flex-col justify-center grow">
          <Badge className="w-fit" colorVariant="accent">
            Space
          </Badge>
          <Skeleton height="26px" width="160px" loading={isLoading}>
            <Text className="text-4">{space.title}</Text>
          </Skeleton>
          <Skeleton height="16px" width="120px" loading={isLoading}>
            <Text className="text-1 text-neutral-11">{space.description}</Text>
          </Skeleton>
        </div>
        <div className="flex justify-between flex-col gap-6 items-end">
          <Skeleton height="16px" width="120px" loading={isLoading}>
            <Text className="text-1 text-gray-500">
              {formatDate(space.createdAt, true)}
            </Text>
          </Skeleton>
        </div>
      </div>
      <div>
        {delegator ? (
          <div className="flex flex-col gap-2">
            <span className="text-1 text-neutral-11 font-bold">Delegate</span>
            <div className="flex gap-3 items-center">
              <Image
                className="h-[32px] w-[32px] rounded-lg"
                src={delegator?.avatarUrl || '/placeholder/default-space.svg'}
                height={32}
                width={32}
                alt={delegator?.nickname}
              />
              <div className="flex gap-1 flex-col">
                <span className="text-1 font-bold text-bg-foreground">
                  {delegator?.name} {delegator?.surname}
                </span>
                <span className="text-1 text-neutral-11">
                  @{delegator?.nickname}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
