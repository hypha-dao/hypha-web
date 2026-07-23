'use client';

import { Card, StatusBadge, Skeleton, Button, Badge } from '@hypha-platform/ui';
import { SewingPinFilledIcon } from '@radix-ui/react-icons';
import { PersonAvatar } from './person-avatar';
import { useEvents } from '@hypha-platform/core/client';
import React from 'react';
import { useParams } from 'next/navigation';
import {
  useSpaceBySlug,
  useUndelegateWeb3Rpc,
} from '@hypha-platform/core/client';
import { useState } from 'react';
import { useSpaceMember } from '../../spaces';
import { useAuthentication } from '@hypha-platform/authentication';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useEffect } from 'react';
import { mutate as mutateCache, type Key } from 'swr';
import { useFormatter, useTranslations } from 'next-intl';
import { LOCAL_DATE_SHORT_FORMAT_OPTIONS } from '@hypha-platform/ui-utils';

export type MemberCardProps = {
  spaceId?: number;
  name?: string;
  surname?: string;
  nickname?: string;
  location?: string;
  avatarUrl?: string;
  status?: string;
  isLoading?: boolean;
  minimize?: boolean;
  address?: string;
};

export const MemberCard: React.FC<MemberCardProps> = ({
  spaceId,
  name,
  surname,
  nickname,
  location,
  avatarUrl,
  status,
  isLoading,
  minimize,
  address,
}) => {
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug(spaceSlug as string);
  const { undelegate, isUndelegating } = useUndelegateWeb3Rpc();
  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
    userAddress: address as `0x${string}`,
  });
  const [localIsDelegate, setLocalIsDelegate] = useState(isDelegate);
  const { isMember } = useSpaceMember({
    spaceId: space?.web3SpaceId as number,
  });
  const { isAuthenticated, user } = useAuthentication();

  const isDisabled = isUndelegating || !isAuthenticated || !isMember;
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember
    ? 'Please join this space to use this feature.'
    : '';

  const { events, isLoadingEvents } = useEvents({
    type: 'joinSpace',
    referenceId: spaceId,
    referenceEntity: 'space',
  });

  const joinEvent = React.useMemo(() => {
    if (!address || isLoadingEvents || !events) {
      return undefined;
    }
    if (events.length === 0) {
      return undefined;
    }
    const normalizedAddress = address.toLowerCase();
    const event = events.find(
      (el) =>
        el.parameters?.['memberAddress']?.toLowerCase?.() === normalizedAddress,
    );
    return event;
  }, [address, events, isLoadingEvents]);

  const delegateCacheKey = React.useMemo<Key | null>(() => {
    const viewerAddress = user?.wallet?.address as `0x${string}` | undefined;
    if (!viewerAddress || !space?.web3SpaceId) return null;
    return [viewerAddress, BigInt(space.web3SpaceId), 'delegate'];
  }, [space?.web3SpaceId, user?.wallet?.address]);

  useEffect(() => {
    setLocalIsDelegate(isDelegate);
  }, [isDelegate]);

  return (
    <Card className="craft-card-interactive flex h-full w-full flex-col gap-2.5 p-3.5">
      <div className="flex items-start gap-3">
        <PersonAvatar
          avatarSrc={avatarUrl}
          userName={nickname}
          size={minimize ? 'sm' : 'lg'}
          isLoading={isLoading}
          shape="rounded"
          className="shrink-0"
        />

        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Badge
              className="w-fit"
              size={1}
              variant="outline"
              colorVariant="neutral"
            >
              {tCommon('memberRoleLabel')}
            </Badge>
            {!minimize ? (
              <StatusBadge isLoading={isLoading} status={status} />
            ) : null}

            <Skeleton
              height="22px"
              width="160px"
              loading={isLoading}
              className="my-0.5"
            >
              <p className="truncate text-3 font-medium tracking-tight text-foreground">
                {name} {surname}
              </p>
            </Skeleton>

            <Skeleton height="16px" width="80px" loading={isLoading}>
              <p className="craft-meta truncate">@{nickname}</p>
            </Skeleton>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {localIsDelegate ? (
              <Skeleton width="96px" height="32px" loading={isLoading}>
                <Button
                  size="sm"
                  variant="outline"
                  colorVariant="neutral"
                  disabled={isDisabled}
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    try {
                      await undelegate({
                        spaceId: space?.web3SpaceId as number,
                      });
                      setLocalIsDelegate(false);
                      if (delegateCacheKey) {
                        await mutateCache(delegateCacheKey);
                      }
                    } catch (error) {
                      console.error('Undelegate failed:', error);
                    }
                  }}
                  title={tooltipMessage}
                >
                  {isUndelegating ? 'Undelegating...' : 'Undelegate'}
                </Button>
              </Skeleton>
            ) : (
              <div className="h-8 w-[7.5rem]" aria-hidden />
            )}
            <Skeleton width="96px" height="16px" loading={isLoading}>
              <div className="craft-meta flex items-center">
                <SewingPinFilledIcon className="mr-1 size-3.5" />
                <span className="text-1">{location}</span>
              </div>
            </Skeleton>
            <Skeleton
              width="96px"
              height="16px"
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
      </div>
      <div className="min-h-5">
        {localIsDelegate ? (
          <span className="craft-meta font-medium">
            {tCommon('delegatedVotingMemberLabel')}
          </span>
        ) : null}
      </div>
    </Card>
  );
};
