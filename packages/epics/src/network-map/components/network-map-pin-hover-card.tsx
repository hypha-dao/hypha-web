'use client';

import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  Space,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../../common';
import { SpaceCard } from '../../spaces/components/space-card';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';

type NetworkMapPinHoverCardProps = {
  lang: Locale;
  space: Space;
  left: number;
  top: number;
};

export function NetworkMapPinHoverCard({
  lang,
  space,
  left,
  top,
}: NetworkMapPinHoverCardProps) {
  const href = getDhoPathAgreements(lang, space.slug);

  return (
    <div
      className="pointer-events-none absolute z-20 w-[min(100%,280px)] shadow-lg"
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
