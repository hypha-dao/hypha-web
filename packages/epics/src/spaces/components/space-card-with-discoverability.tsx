'use client';

import { Space } from '@hypha-platform/core/client';
import { SpaceCard } from './space-card';
import { useSpaceDiscoverability } from '../hooks/use-space-discoverability';
import { useUserSpaceState } from '../hooks/use-user-space-state';
import { shouldShowSpace } from '../hooks/use-filter-spaces-by-discoverability';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import Link from 'next/link';

type SpaceCardWithDiscoverabilityProps = {
  space: Space;
  getHref: (slug: string) => string;
  isLoading?: boolean;
};

export function SpaceCardWithDiscoverability({
  space,
  getHref,
  isLoading,
}: SpaceCardWithDiscoverabilityProps) {
  const { discoverability, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: space.web3SpaceId ? BigInt(space.web3SpaceId) : undefined,
    });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceSlug: space.slug,
    space,
  });

  if (!space.web3SpaceId) {
    return (
      <Link
        className="flex flex-col flex-1"
        href={getHref(space.slug as string)}
      >
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
          web3SpaceId={space.web3SpaceId as number}
          configPath={`${getHref(space.slug).replace(
            /\/*$/,
            '',
          )}/space-configuration`}
          createdAt={space.createdAt}
        />
      </Link>
    );
  }

  const shouldShow = shouldShowSpace(space, discoverability, userState);
  const isChecking = isDiscoverabilityLoading || isUserStateLoading;

  if (isChecking || discoverability === undefined) {
    return (
      <Link
        className="flex flex-col flex-1"
        href={getHref(space.slug as string)}
      >
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
          web3SpaceId={space.web3SpaceId as number}
          configPath={`${getHref(space.slug).replace(
            /\/*$/,
            '',
          )}/space-configuration`}
          createdAt={space.createdAt}
        />
      </Link>
    );
  }

  if (!shouldShow) {
    return null;
  }

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
        web3SpaceId={space.web3SpaceId as number}
        configPath={`${getHref(space.slug).replace(
          /\/*$/,
          '',
        )}/space-configuration`}
        createdAt={space.createdAt}
      />
    </Link>
  );
}
