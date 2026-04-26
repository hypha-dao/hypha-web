'use client';

import { Card, StatusBadge, Skeleton, Button, Badge } from '@hypha-platform/ui';
import { SewingPinFilledIcon } from '@radix-ui/react-icons';
import { PersonAvatar } from './person-avatar';
import { useEvents } from '@hypha-platform/core/client';
import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useSpaceBySlug,
  useUndelegateWeb3Rpc,
} from '@hypha-platform/core/client';
import { useState, useEffect } from 'react';
import { useSpaceMember } from '../../spaces';
import { useAuthentication } from '@hypha-platform/authentication';
import { useIsDelegate } from '@hypha-platform/core/client';
import { mutate as mutateCache, type Key } from 'swr';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Calendar } from 'lucide-react';

const JOIN_DATE_FORMAT = {
  year: 'numeric' as const,
  month: 'short' as const,
  day: 'numeric' as const,
};

export type MemberCardProps = {
  spaceId?: number;
  name?: string;
  surname?: string;
  nickname?: string;
  location?: string;
  avatarUrl?: string;
  status?: string;
  isLoading?: boolean;
  address?: string;
  profileHref?: string;
  className?: string;
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
  address,
  profileHref,
  className,
}) => {
  const tCommon = useTranslations('Common');
  const tMembers = useTranslations('MembersTab');
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
  const actionTooltip = !isAuthenticated
    ? tCommon('signIn')
    : !isMember
    ? tCommon('joinSpaceToUse')
    : undefined;

  const { events, isLoadingEvents } = useEvents({
    type: 'joinSpace',
    referenceId: spaceId,
    referenceEntity: 'space',
  });

  const joinEvent = React.useMemo(() => {
    if (!address || isLoadingEvents || !events?.length) return undefined;
    const n = address.toLowerCase();
    return events.find(
      (el) => el.parameters?.['memberAddress']?.toLowerCase?.() === n,
    );
  }, [address, events, isLoadingEvents]);

  const delegateCacheKey = React.useMemo<Key | null>(() => {
    const v = user?.wallet?.address as `0x${string}` | undefined;
    if (!v || !space?.web3SpaceId) return null;
    return [v, BigInt(space.web3SpaceId), 'delegate'];
  }, [space?.web3SpaceId, user?.wallet?.address]);

  useEffect(() => {
    setLocalIsDelegate(isDelegate);
  }, [isDelegate]);

  const onUndelegate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void (async () => {
      try {
        await undelegate({ spaceId: space?.web3SpaceId as number });
        setLocalIsDelegate(false);
        if (delegateCacheKey) await mutateCache(delegateCacheKey);
      } catch (err) {
        console.error('Undelegate failed:', err);
        setLocalIsDelegate(true);
        window.alert(tMembers('delegateSection.errors.undelegateFailed'));
      }
    })();
  };

  const fullName = [name, surname].filter(Boolean).join(' ').trim() || '—';
  const atNick = nickname ? `@${nickname}` : '';
  const joinLine =
    joinEvent &&
    tCommon('joinedSpaceOn', {
      date: format.dateTime(new Date(joinEvent.createdAt), JOIN_DATE_FORMAT),
    });

  const metaForTitle = [joinLine, location?.trim()].filter(Boolean).join(' · ');

  const heroVisual = (
    <div className="relative isolate overflow-hidden">
      <div
        className={cn(
          'relative h-[5.25rem] w-full overflow-hidden bg-muted/50',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-background/55 after:to-background',
        )}
      >
        {isLoading ? (
          <Skeleton
            className="h-full w-full rounded-none"
            loading
            height="100%"
          />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent-5/35 via-muted/60 to-background"
            aria-hidden
          />
        )}
      </div>
      <div className="relative z-10 -mt-10 px-3">
        <PersonAvatar
          avatarSrc={avatarUrl}
          userName={nickname}
          size="lg"
          isLoading={isLoading}
          shape="circle"
          className="shrink-0 shadow-md ring-4 ring-card"
        />
      </div>
    </div>
  );

  const mainBlock = (
    <div className="min-w-0 space-y-2 px-3 pb-3 pt-1">
      {heroVisual}
      <div className="flex min-w-0 items-start justify-between gap-1.5 pt-0.5">
        {isLoading ? (
          <Skeleton className="my-0.5" width="7rem" height="1.1rem" loading />
        ) : (
          <p
            className="text-4 line-clamp-1 font-medium leading-tight"
            title={fullName}
          >
            {fullName}
          </p>
        )}
        <Badge
          className="h-fit max-w-[40%] shrink-0 border text-[10px] font-medium uppercase"
          variant="outline"
          colorVariant="neutral"
        >
          {tCommon('memberRoleLabel')}
        </Badge>
      </div>
      {isLoading ? (
        <Skeleton className="mt-0.5" width="5rem" height="0.7rem" loading />
      ) : (
        <p
          className="mt-0.5 line-clamp-1 text-1 text-muted-foreground"
          title={atNick || undefined}
        >
          {atNick || '\u00a0'}
        </p>
      )}
      <div className="min-h-5 w-full" aria-hidden />
      <div className="flex min-h-5 w-full max-w-full flex-wrap content-center gap-1.5">
        <StatusBadge isLoading={isLoading} status={status} />
      </div>
      {isLoading ? (
        <Skeleton className="mt-0.5" width="100%" height="0.75rem" loading />
      ) : (
        <p
          className="line-clamp-2 min-h-8 text-1 text-muted-foreground"
          title={metaForTitle || undefined}
        >
          {joinLine || location?.trim() ? (
            <span>
              {joinLine ? (
                <span className="inline" title={joinLine}>
                  <Calendar
                    className="mr-0.5 inline h-3 w-3 -translate-y-0.5 opacity-80"
                    aria-hidden
                  />
                  {joinLine}
                </span>
              ) : null}
              {joinLine && location?.trim() ? ' · ' : null}
              {location?.trim() ? (
                <span className="inline" title={location}>
                  <SewingPinFilledIcon
                    className="mr-0.5 inline h-3 w-3 -translate-y-0.5 opacity-80"
                    aria-hidden
                  />
                  {location}
                </span>
              ) : null}
            </span>
          ) : null}
        </p>
      )}
    </div>
  );

  const delegateFooter = localIsDelegate ? (
    <div className="space-y-2 border-t border-border/60 p-2.5">
      <p className="text-1 text-muted-foreground">
        {tCommon('delegatedVotingMemberLabel')}
      </p>
      <Button
        type="button"
        className="w-full"
        size="sm"
        variant="outline"
        colorVariant="accent"
        disabled={isDisabled}
        onClick={onUndelegate}
        title={actionTooltip}
      >
        {isUndelegating
          ? tMembers('delegateSection.undelegating')
          : tMembers('delegateSection.undelegate')}
      </Button>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <Card
        className={cn('h-full min-h-36 w-full min-w-0 p-0', className)}
        data-testid="member-card-skeleton"
      >
        {mainBlock}
      </Card>
    );
  }

  const useSplit = Boolean(profileHref && localIsDelegate);
  const singleLink = profileHref && !localIsDelegate;

  return (
    <Card
      className={cn(
        'flex h-full min-h-36 w-full min-w-0 flex-col overflow-hidden p-0',
        'border-border/80 transition-shadow duration-150 hover:border-border hover:shadow-sm',
        'motion-reduce:transition-none',
        className,
      )}
      data-testid="member-card-grid"
    >
      {useSplit && profileHref ? (
        <>
          <Link
            href={profileHref}
            scroll={false}
            className="block w-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mainBlock}
          </Link>
          {delegateFooter}
        </>
      ) : singleLink && profileHref ? (
        <Link
          href={profileHref}
          scroll={false}
          className="block w-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {mainBlock}
        </Link>
      ) : (
        <>
          {mainBlock}
          {delegateFooter}
        </>
      )}
    </Card>
  );
};
