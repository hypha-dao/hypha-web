'use client';

import { Card, Skeleton, Image, Badge } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/server';
import { Text } from '@radix-ui/themes';
import { useSpaceDelegate } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useEvents } from '@hypha-platform/core/client';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Calendar, LayoutGrid } from 'lucide-react';

const JOIN_DATE_FORMAT = {
  year: 'numeric' as const,
  month: 'short' as const,
  day: 'numeric' as const,
};

type SpaceMemberCardProps = {
  hostSpaceId?: number;
  space: Space;
  isLoading?: boolean;
  className?: string;
};

/**
 * Nested space on the members roster. Parent `Link` in `MembersList` provides navigation;
 * this component must not render nested interactive links.
 */
export const SpaceMemberCard: React.FC<SpaceMemberCardProps> = ({
  hostSpaceId: spaceId,
  space,
  isLoading,
  className,
}) => {
  const tCommon = useTranslations('Common');
  const tMembers = useTranslations('MembersTab');
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
    if (!space?.address || isLoadingEvents || !events) return undefined;
    const n = space.address.toLowerCase();
    return events.find(
      (el) => el.parameters?.['memberAddress']?.toLowerCase?.() === n,
    );
  }, [space, events, isLoadingEvents]);

  const joinLine =
    joinEvent &&
    tCommon('joinedSpaceOn', {
      date: format.dateTime(new Date(joinEvent.createdAt), JOIN_DATE_FORMAT),
    });

  const desc = space.description?.trim() ?? '';
  const metaTitle = [desc, joinLine].filter(Boolean).join(' · ');

  return (
    <Card
      className={cn(
        'h-full min-h-36 w-full min-w-0 border-l-2 border-l-muted-foreground/25 p-0',
        'transition-shadow duration-150 hover:shadow-sm motion-reduce:transition-none',
        'border border-border/80',
        className,
      )}
      data-testid="space-member-card-grid"
    >
      <div className="flex min-w-0 gap-2.5 p-3">
        <div className="shrink-0 self-start">
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading}
            className="rounded-md"
          >
            <div className="h-10 w-10 overflow-hidden rounded-md border border-border/60">
              <Image
                className="h-10 w-10 object-cover"
                src={space.logoUrl || '/placeholder/default-space.svg'}
                height={40}
                width={40}
                alt=""
              />
            </div>
          </Skeleton>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <LayoutGrid
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="sr-only">{tMembers('nestedSpaceTypeLabel')}</span>
            <Badge
              className="h-5 max-w-full shrink-0 border text-[10px] font-semibold uppercase tracking-wide"
              colorVariant="accent"
            >
              {tMembers('nestedSpaceTypeLabel')}
            </Badge>
          </div>
          {isLoading ? (
            <Skeleton className="mt-1.5" width="8rem" height="1rem" loading />
          ) : (
            <Text
              as="p"
              className="mt-1.5 line-clamp-2 text-4 font-medium leading-snug"
              title={space.title}
            >
              {space.title}
            </Text>
          )}
        </div>
      </div>

      <div className="min-h-5 px-3" aria-hidden />

      {isLoading ? (
        <div className="px-3 pb-3">
          <Skeleton className="mt-1.5" width="100%" height="0.75rem" loading />
        </div>
      ) : desc || joinLine ? (
        <p
          className="line-clamp-2 min-h-8 px-3 pb-2 text-1 text-muted-foreground"
          title={metaTitle || undefined}
        >
          {desc ? <span className="block line-clamp-1">{desc}</span> : null}
          {desc && joinLine ? ' · ' : null}
          {joinLine ? (
            <span className="inline" title={joinLine}>
              <Calendar
                className="mr-0.5 inline h-3 w-3 -translate-y-0.5 opacity-80"
                aria-hidden
              />
              {joinLine}
            </span>
          ) : null}
        </p>
      ) : null}

      {delegator && !isLoading ? (
        <div className="border-t border-border/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            {tMembers('spaceDelegateLabel')}
          </p>
          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-border/60">
              <Image
                className="h-7 w-7 object-cover"
                src={delegator.avatarUrl || '/placeholder/default-space.svg'}
                height={28}
                width={28}
                alt=""
              />
            </div>
            <div className="min-w-0">
              <p
                className="line-clamp-1 text-1 font-medium leading-tight"
                title={[delegator.name, delegator.surname]
                  .filter(Boolean)
                  .join(' ')}
              >
                {delegator.name} {delegator.surname}
              </p>
              {delegator.nickname ? (
                <p
                  className="line-clamp-1 text-1 text-muted-foreground"
                  title={`@${delegator.nickname}`}
                >
                  @{delegator.nickname}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
