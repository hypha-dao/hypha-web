'use client';

import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  Space,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { Avatar, AvatarImage, Card } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Locale } from '@hypha-platform/i18n';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getDhoPathAgreements } from '../../common';
import { SpaceCard } from '../../spaces/components/space-card';
import { SpaceModeLabel } from '../../spaces/components/space-mode-label';

type NetworkMapPinHoverCardProps = {
  lang: Locale;
  space: Space;
  compact?: boolean;
  left?: number;
  top?: number;
};

export function NetworkMapPinHoverCard({
  lang,
  space,
  compact = false,
  left = 0,
  top = 0,
}: NetworkMapPinHoverCardProps) {
  const href = getDhoPathAgreements(lang, space.slug);
  const tCommon = useTranslations('Common');

  if (compact) {
    return (
      <div
        className="pointer-events-none absolute inset-x-2 bottom-2 z-20"
        data-network-map-hover-card
      >
        <Link href={href} className="pointer-events-auto block">
          <Card className="flex items-center gap-3 border border-border bg-background p-3 shadow-sm">
            <Avatar className="size-10 shrink-0">
              <AvatarImage
                src={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                alt=""
              />
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-3 font-medium">{space.title}</p>
              <p className="text-1 text-neutral-11">
                <span className="font-bold text-neutral-12">
                  {space.memberCount}
                </span>{' '}
                {tCommon('Members')}
              </p>
            </div>
            <SpaceModeLabel
              web3SpaceId={space.web3SpaceId ?? undefined}
              isSandbox={space.flags?.includes('sandbox') ?? false}
              isDemo={space.flags?.includes('demo') ?? false}
              isArchived={isSpaceArchived(space)}
              className="shrink-0"
            />
            <ChevronRight
              className="size-4 shrink-0 text-neutral-11"
              aria-hidden
            />
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-20 w-[min(100%,280px)] shadow-sm',
      )}
      data-network-map-hover-card
      style={{ left, top }}
    >
      <Link href={href} className="pointer-events-auto block">
        <SpaceCard
          description={space.description ?? ''}
          icon={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
          leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
          title={space.title}
          members={space.memberCount}
          agreements={space.documentCount}
          isSandbox={space.flags?.includes('sandbox') ?? false}
          isDemo={space.flags?.includes('demo') ?? false}
          isArchived={isSpaceArchived(space)}
          web3SpaceId={space.web3SpaceId ?? undefined}
          createdAt={space.createdAt}
          className="bg-background"
        />
      </Link>
    </div>
  );
}

function clampHoverPosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  cardWidth = 280,
  cardHeight = 300,
  offset = 12,
) {
  let left = x + offset;
  let top = y + offset;
  if (left + cardWidth > containerWidth - 8) {
    left = x - cardWidth - offset;
  }
  if (top + cardHeight > containerHeight - 8) {
    top = y - cardHeight - offset;
  }
  return {
    left: Math.max(8, Math.min(left, containerWidth - cardWidth - 8)),
    top: Math.max(8, Math.min(top, containerHeight - cardHeight - 8)),
  };
}

export { clampHoverPosition };
