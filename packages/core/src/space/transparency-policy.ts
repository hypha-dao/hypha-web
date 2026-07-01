export enum SpaceTransparencyLevel {
  PUBLIC = 0,
  NETWORK = 1,
  ORGANISATION = 2,
  SPACE = 3,
}

const TRANSPARENCY_LEVEL_LABELS: Record<SpaceTransparencyLevel, string> = {
  [SpaceTransparencyLevel.PUBLIC]: 'Public',
  [SpaceTransparencyLevel.NETWORK]: 'Network',
  [SpaceTransparencyLevel.ORGANISATION]: 'Organisation members',
  [SpaceTransparencyLevel.SPACE]: 'Space members only',
};

export type SpaceOnChainTransparency = {
  discoverability: SpaceTransparencyLevel;
  access: SpaceTransparencyLevel;
};

export function labelTransparencyLevel(level: SpaceTransparencyLevel): string {
  return TRANSPARENCY_LEVEL_LABELS[level] ?? 'Unknown';
}

export function assessSpacePrivacy({
  flags,
  transparency,
}: {
  flags?: string[] | null;
  transparency: SpaceOnChainTransparency | null;
}): {
  isAlreadyPrivate: boolean;
  summary: string;
  activationMode: 'sandbox' | 'pilot' | 'live' | 'archived' | 'unknown';
} {
  const isSandbox = flags?.includes('sandbox') === true;
  const isDemo = flags?.includes('demo') === true;
  const isArchived = flags?.includes('archived') === true;
  const activationMode = isArchived
    ? 'archived'
    : isSandbox
    ? 'sandbox'
    : isDemo
    ? 'pilot'
    : 'live';

  if (!transparency) {
    if (isSandbox) {
      return {
        isAlreadyPrivate: true,
        activationMode,
        summary:
          'This space is in Sandbox mode — configured for private testing on My Spaces, not public network discovery.',
      };
    }
    return {
      isAlreadyPrivate: false,
      activationMode,
      summary:
        'On-chain transparency settings could not be read. Use a Space Transparency proposal to change discoverability or activity access.',
    };
  }

  const { discoverability, access } = transparency;
  const discoverabilityLabel = labelTransparencyLevel(discoverability);
  const accessLabel = labelTransparencyLevel(access);

  const isRestrictiveDiscoverability =
    discoverability >= SpaceTransparencyLevel.ORGANISATION;
  const isRestrictiveAccess = access >= SpaceTransparencyLevel.ORGANISATION;
  const isAlreadyPrivate =
    isSandbox ||
    discoverability === SpaceTransparencyLevel.SPACE ||
    (isRestrictiveDiscoverability && isRestrictiveAccess);

  let summary: string;
  if (isAlreadyPrivate) {
    summary = isSandbox
      ? `This space is already private — Sandbox mode with ${discoverabilityLabel.toLowerCase()} discoverability and ${accessLabel.toLowerCase()} activity access.`
      : `This space is already set to restrictive transparency — ${discoverabilityLabel} discoverability and ${accessLabel} activity access.`;
  } else {
    summary = `Current transparency: ${discoverabilityLabel} discoverability and ${accessLabel} activity access. Changes require a Space Transparency proposal and member vote.`;
  }

  return { isAlreadyPrivate, summary, activationMode };
}

export function transparencyLevelsMatchRequest(
  current: { discoverability: number; access: number },
  desired: { discoverability?: number; access?: number },
): boolean {
  const discoverabilityMatches =
    desired.discoverability === undefined ||
    current.discoverability === desired.discoverability;
  const accessMatches =
    desired.access === undefined || current.access === desired.access;
  return discoverabilityMatches && accessMatches;
}
