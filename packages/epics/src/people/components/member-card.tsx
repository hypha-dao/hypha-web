'use client';

import { Text } from '@radix-ui/themes';
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
    <Card className="w-full h-full p-5 mb-2 flex gap-3 flex-col">
      <div className="flex items-center">
        <PersonAvatar
          avatarSrc={avatarUrl}
          userName={nickname}
          size={minimize ? 'sm' : 'lg'}
          isLoading={isLoading}
          shape="rounded"
          className="mr-3"
        />

        <div className="flex justify-between items-center w-full">
          <div className="flex flex-col">
            <Badge className="w-fit" variant="outline" colorVariant="accent">
              {tCommon('memberRoleLabel')}
            </Badge>
            {!minimize ? (
              <div className="flex gap-x-1">
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
              <Text className="text-1 text-gray-500">@{nickname}</Text>
            </Skeleton>
          </div>

          <div className="flex justify-between flex-col gap-6 items-end">
            {localIsDelegate ? (
              <Skeleton width="96px" height="32px" loading={isLoading}>
                <Button
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
              <div className="w-[130px] h-[40px]" />
            )}
            <Skeleton
              width="96px"
              height="16px"
              loading={isLoading}
              className={localIsDelegate ? 'mt-2' : ''}
            >
              <div className="flex items-center text-gray-500">
                <SewingPinFilledIcon className="mr-1" />
                <Text className="text-1">{location}</Text>
              </div>
            </Skeleton>
            <Skeleton
              width="96px"
              height="16px"
              loading={isLoading || isLoadingEvents}
              className={localIsDelegate ? 'mt-2' : ''}
            >
              <div className="flex h-4 items-center text-gray-500">
                {joinEvent ? (
                  <Text
                    className="text-1 whitespace-nowrap"
                    title={format.dateTime(new Date(joinEvent.createdAt), {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  >
                    {tCommon('joinedSpaceOn', {
                      date: format.dateTime(new Date(joinEvent.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }),
                    })}
                  </Text>
                ) : null}
              </div>
            </Skeleton>
          </div>
        </div>
      </div>
      <div className="min-h-5">
        {localIsDelegate ? (
          <span className="text-1 font-medium text-neutral-11">
            {tCommon('delegatedVotingMemberLabel')}
          </span>
        ) : null}
      </div>
    </Card>
  );
};
