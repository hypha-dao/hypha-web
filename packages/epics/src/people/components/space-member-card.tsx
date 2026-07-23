'use client';

import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/server';
import { useSpaceDelegate } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useEvents } from '@hypha-platform/core/client';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { LOCAL_DATE_SHORT_FORMAT_OPTIONS } from '@hypha-platform/ui-utils';

export const SpaceMemberCard: React.FC<{
  hostSpaceId?: number;
  space: Space;
  isLoading?: boolean;
}> = ({ hostSpaceId: spaceId, space, isLoading }) => {
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const { id: spaceSlug } = useParams();
  const { space: currentSpace } = useSpaceBySlug(spaceSlug as string);
  const { person: delegator } = useSpaceDelegate({
    user: space?.address as `0x${string}`,
    spaceId: currentSpace?.web3SpaceId as number,
  });

  const { events, isLoadingEvents } = useEvents({
    type: 'joinSpace',
    referenceId: spaceId,
    referenceEntity: 'space',
  });

  const joinEvent = React.useMemo(() => {
    if (!space?.address || isLoadingEvents || !events) {
      return undefined;
    }
    if (events.length === 0) {
      return undefined;
    }
    const normalizedAddress = space.address.toLowerCase();
    const event = events.find(
      (el) =>
        el.parameters?.['memberAddress']?.toLowerCase?.() === normalizedAddress,
    );
    return event;
  }, [space, events, isLoadingEvents]);

  return (
    <Card className="craft-card-interactive flex h-full w-full flex-col gap-3 p-3.5">
      <div className="flex gap-3">
        <Skeleton
          width="48px"
          height="48px"
          loading={isLoading}
          className="shrink-0 rounded-full"
        >
          <Image
            className="size-12 rounded-full object-cover"
            src={space.logoUrl || '/placeholder/default-space.svg'}
            height={48}
            width={48}
            alt={space.title}
          />
        </Skeleton>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <Badge
            className="w-fit"
            size={1}
            variant="outline"
            colorVariant="neutral"
          >
            Space
          </Badge>
          <Skeleton height="22px" width="160px" loading={isLoading}>
            <p className="truncate text-3 font-medium tracking-tight text-foreground">
              {space.title}
            </p>
          </Skeleton>
          <Skeleton height="16px" width="120px" loading={isLoading}>
            <p className="craft-meta line-clamp-1">{space.description}</p>
          </Skeleton>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-start">
          <Skeleton
            height="16px"
            width="120px"
            loading={isLoading || isLoadingEvents}
          >
            <div className="flex h-4 items-center">
              {joinEvent ? (
                <span
                  className="craft-meta whitespace-nowrap"
                  title={format.dateTime(new Date(joinEvent.createdAt), {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                >
                  {tCommon('joinedSpaceOn', {
                    date: format.dateTime(
                      new Date(joinEvent.createdAt),
                      LOCAL_DATE_SHORT_FORMAT_OPTIONS,
                    ),
                  })}
                </span>
              ) : null}
            </div>
          </Skeleton>
        </div>
      </div>
      <div className="min-h-12">
        {delegator ? (
          <div className="flex flex-col gap-2">
            <span className="craft-meta font-medium">Delegate</span>
            <div className="flex items-center gap-2.5">
              <Image
                className="size-8 rounded-lg object-cover"
                src={delegator?.avatarUrl || '/placeholder/default-space.svg'}
                height={32}
                width={32}
                alt={delegator?.nickname}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-1 font-medium text-foreground">
                  {delegator?.name} {delegator?.surname}
                </span>
                <span className="craft-meta truncate">
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
