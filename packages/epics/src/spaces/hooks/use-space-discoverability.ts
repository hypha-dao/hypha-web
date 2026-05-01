'use client';

import React from 'react';
import useSWR from 'swr';
import { publicClient, getSpaceVisibility } from '@hypha-platform/core/client';
import { TransparencyLevel } from '../components/transparency-level';

function isValidOnChainSpaceId(
  id: number | bigint | null | undefined,
): id is number | bigint {
  if (id === null || id === undefined) return false;
  if (typeof id === 'bigint') return id > 0n;
  if (typeof id === 'number') {
    return Number.isFinite(id) && id > 0;
  }
  return false;
}

export function useSpaceDiscoverability({
  spaceId,
}: {
  spaceId?: number | bigint;
}) {
  const swrKey = isValidOnChainSpaceId(spaceId)
    ? [spaceId, 'getSpaceVisibility' as const]
    : null;

  const {
    data: visibility,
    isLoading,
    error,
  } = useSWR(
    swrKey,
    async ([spaceId]: readonly [number | bigint, 'getSpaceVisibility']) => {
      const spaceIdBigInt =
        typeof spaceId === 'number' ? BigInt(spaceId) : spaceId;
      return publicClient.readContract(
        getSpaceVisibility({ spaceId: spaceIdBigInt }),
      );
    },
    { revalidateOnFocus: true },
  );

  const discoverability = React.useMemo(() => {
    if (!visibility) return undefined;
    const discoverabilityValue =
      'discoverability' in visibility
        ? visibility.discoverability
        : (visibility as unknown as [bigint, bigint])[0];
    const accessValue =
      'access' in visibility
        ? visibility.access
        : (visibility as unknown as [bigint, bigint])[1];
    return {
      discoverability: Number(discoverabilityValue) as TransparencyLevel,
      access: Number(accessValue) as TransparencyLevel,
    };
  }, [visibility]);

  return {
    discoverability: discoverability?.discoverability,
    access: discoverability?.access,
    isLoading,
    error,
  };
}
