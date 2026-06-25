import type { SpaceFlags } from '@hypha-platform/core/client';
import {
  assessSpacePrivacy,
  labelTransparencyLevel,
  readSpaceOnChainTransparency,
  type SpaceOnChainTransparency,
} from '@hypha-platform/core/server';

export type SpaceTransparencySnapshot = {
  activationMode: 'sandbox' | 'pilot' | 'live' | 'archived' | 'unknown';
  flags: SpaceFlags[];
  onChainTransparency: {
    discoverability: number;
    access: number;
    discoverabilityLabel: string;
    accessLabel: string;
  } | null;
  privacy: {
    isAlreadyPrivate: boolean;
    summary: string;
  };
  governance: {
    transparencyChangesRequire: 'Space Transparency proposal and member vote';
    metadataOnlyTools: ['update_space_settings', 'space_configuration'];
  };
};

export async function buildSpaceTransparencySnapshot(input: {
  web3SpaceId: number | null | undefined;
  flags?: string[] | null;
}): Promise<SpaceTransparencySnapshot> {
  const flags = (input.flags ?? []) as SpaceFlags[];
  const onChain = input.web3SpaceId
    ? await readSpaceOnChainTransparency(input.web3SpaceId)
    : null;
  const privacy = assessSpacePrivacy({ flags, transparency: onChain });

  return {
    activationMode: privacy.activationMode,
    flags,
    onChainTransparency: onChain
      ? {
          discoverability: onChain.discoverability,
          access: onChain.access,
          discoverabilityLabel: labelTransparencyLevel(onChain.discoverability),
          accessLabel: labelTransparencyLevel(onChain.access),
        }
      : null,
    privacy: {
      isAlreadyPrivate: privacy.isAlreadyPrivate,
      summary: privacy.summary,
    },
    governance: {
      transparencyChangesRequire: 'Space Transparency proposal and member vote',
      metadataOnlyTools: ['update_space_settings', 'space_configuration'],
    },
  };
}

export { transparencyLevelsMatchRequest } from '@hypha-platform/core/client';
