import 'server-only';

import type { DbConfig } from '../../server';
import { getPayingSpacesMetrics } from './paying-spaces';
import { getPlatformAssetsSummary } from './assets-summary';
import { getPlatformSignalsStats } from './signals-stats';
import { getPlatformSpaceMemoryStats } from './space-memory-stats';

import type { PlatformDashboardData } from '../../platform/types';

export async function getPlatformDashboard({
  db,
}: DbConfig): Promise<PlatformDashboardData> {
  const [payingSpaces, assets, signals, spaceMemory] = await Promise.all([
    getPayingSpacesMetrics({ db }),
    getPlatformAssetsSummary({ db }),
    getPlatformSignalsStats({ db }),
    getPlatformSpaceMemoryStats({ db }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    payingSpaces,
    assets,
    signals,
    spaceMemory,
  };
}

export type { PlatformDashboardData } from '../../platform/types';
