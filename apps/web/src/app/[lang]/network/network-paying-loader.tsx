import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@hypha-platform/storage-postgres';
import { getPayingSpacesMetrics } from '@hypha-platform/core/server';
import {
  toNetworkPayingSnapshot,
  type NetworkPayingSnapshot,
} from '@hypha-platform/core/client';

const getCachedPayingSnapshot = unstable_cache(
  async () => toNetworkPayingSnapshot(await getPayingSpacesMetrics({ db })),
  ['network-dashboard-paying-v2'],
  { revalidate: 300 },
);

export const loadNetworkPayingSnapshot = cache(
  async (): Promise<NetworkPayingSnapshot | null> => {
    try {
      return await getCachedPayingSnapshot();
    } catch (error) {
      console.error(
        'Failed to load paying spaces for network dashboard',
        error,
      );
      return null;
    }
  },
);
