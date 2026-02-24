'use client';

import { Space } from '@hypha-platform/core/client';
import { SpaceCard } from './space-card';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import Link from 'next/link';
import { useSpaceMember } from '../hooks';

type SpaceCardWithDiscoverabilityProps = {
  space: Space;
  getHref: (slug: string) => string;
  isLoading?: boolean;
  showExitButton?: boolean;
};

export function SpaceCardWithDiscoverability({
  space,
  getHref,
  isLoading,
  showExitButton,
}: SpaceCardWithDiscoverabilityProps) {
  const { isMember } = useSpaceMember({
    spaceId: space.web3SpaceId ?? undefined,
  });

  const shouldShowExitButton = showExitButton && isMember === true;

  return (
    <Link className="flex flex-col flex-1" href={getHref(space.slug as string)}>
      <SpaceCard
        description={space.description as string}
        icon={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
        leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
        title={space.title as string}
        isLoading={isLoading}
        members={space.memberCount}
        agreements={space.documentCount}
        isSandbox={space.flags?.includes('sandbox') ?? false}
        isDemo={space.flags?.includes('demo') ?? false}
        isArchived={space.flags?.includes('archived') ?? false}
        web3SpaceId={space.web3SpaceId as number}
        configPath={`${getHref(space.slug).replace(
          /\/+$/,
          '',
        )}/space-configuration`}
        createdAt={space.createdAt}
        showExitButton={shouldShowExitButton}
      />
    </Link>
  );
}
