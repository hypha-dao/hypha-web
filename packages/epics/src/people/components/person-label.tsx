'use client';

import { Skeleton, Badge } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { PersonAvatar } from './person-avatar';
import { useIsDelegate, useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';

export interface Creator {
  name?: string;
  surname?: string;
  avatarUrl?: string;
  type?: 'person' | 'space';
  address?: string;
}

interface PersonLabelProps {
  creator?: Creator;
  isLoading?: boolean;
  hasAvatar?: boolean;
}

export const PersonLabel = ({
  isLoading,
  creator,
  hasAvatar = true,
}: PersonLabelProps) => {
  const { id: spaceSlug } = useParams();
  const { space: currentSpace } = useSpaceBySlug(spaceSlug as string);
  const { isDelegate } = useIsDelegate({
    spaceId: currentSpace?.web3SpaceId as number,
    userAddress: creator?.address as `0x${string}`,
  });
  return (
    <div className="flex items-center space-x-2">
      {hasAvatar ? (
        <PersonAvatar
          isLoading={isLoading}
          size="sm"
          avatarSrc={creator?.avatarUrl}
          userName={`${creator?.name} ${creator?.surname}`}
        />
      ) : null}

      <Skeleton width="50px" height="16px" loading={isLoading}>
        <Text className="text-1 text-neutral-11">
          {creator?.name} {creator?.surname}
        </Text>
      </Skeleton>
      {isDelegate && (
        <Badge colorVariant="accent" variant="outline" size={1}>
          Delegate
        </Badge>
      )}
    </div>
  );
};
