import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@hypha-platform/storage-postgres';
import { findNetworkTreasuryStats } from '@hypha-platform/core/server';
import type { NetworkTreasurySnapshot } from '@hypha-platform/core/client';

const getCachedTreasurySnapshot = unstable_cache(
  async () => findNetworkTreasuryStats({ db }),
  ['network-dashboard-treasury-v2'],
  { revalidate: 300 },
);

export const loadNetworkTreasurySnapshot = cache(
  async (): Promise<NetworkTreasurySnapshot | null> => {
    try {
      return await getCachedTreasurySnapshot();
    } catch (error) {
      console.error('Failed to load network treasury snapshot', error);
      return null;
    }
  },
);
