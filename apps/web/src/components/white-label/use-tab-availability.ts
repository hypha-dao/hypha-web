'use client';

import { useActionStatus, useSpaceEnergy } from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';

import type { NavAvailability } from '@web/lib/white-label/nav';

/**
 * What this Space can serve among the tabs that exist only for some Spaces
 * (one source for the menu and for the landing fallback), and whether the
 * client-side answers have loaded (`energy` and `pipeline` need a fetch).
 */
export function useTabAvailability(
  spaceSlug: string,
  flags: { coherenceEnabled: boolean; memoryEnabled: boolean },
): {
  available: NavAvailability;
  settled: { energy: boolean; pipeline: boolean };
} {
  const {
    data: energy,
    isLoading: energyLoading,
    error,
  } = useSpaceEnergy(spaceSlug);
  const { space, isLoading: spaceLoading } = useSpaceBySlug(spaceSlug);
  // The pipeline is members only: on a delivery without login it never has data.
  const pipelineLive = useActionStatus('pipeline-data') === 'live';
  return {
    available: {
      energy: energy?.enabled === true,
      coherence: flags.coherenceEnabled,
      pipeline: Boolean(space?.pipelineEnabled) && pipelineLive,
      memory: flags.memoryEnabled,
    },
    settled: {
      energy: !energyLoading && (energy != null || Boolean(error)),
      pipeline: !spaceLoading && space != null,
    },
  };
}
