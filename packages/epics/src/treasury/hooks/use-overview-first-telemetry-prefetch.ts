'use client';

import { useAfterIdle } from '../../common/use-after-idle';

/**
 * Overview must paint from `/energy` alone. 7d/30d Azure scans are useful
 * once Production is likely, but they compete with avatar/banner bytes if
 * they start in the same turn as the consumer grid.
 *
 * Prefetch starts after the first paint (idle, 1.2s cap). Opening a tab
 * other than Overview starts it immediately.
 */
export function useOverviewFirstTelemetryPrefetch(
  energyEnabled: boolean,
  tab: string,
): boolean {
  const afterOverviewPaint = useAfterIdle(energyEnabled && tab === 'overview');
  return energyEnabled && (afterOverviewPaint || tab !== 'overview');
}
