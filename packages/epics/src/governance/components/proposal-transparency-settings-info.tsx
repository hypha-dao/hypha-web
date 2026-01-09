'use client';

import { TransparencyLevel } from '../../spaces/components/transparency-level';

interface ProposalTransparencySettingsInfoProps {
  spaceDiscoverability?: TransparencyLevel;
  spaceActivityAccess?: TransparencyLevel;
}

const getTransparencyLevelLabel = (
  level: TransparencyLevel | undefined,
): string => {
  if (level === undefined) return 'Unknown';

  switch (level) {
    case TransparencyLevel.PUBLIC:
      return 'Public';
    case TransparencyLevel.NETWORK:
      return 'Network';
    case TransparencyLevel.ORGANISATION:
      return 'Organisation';
    case TransparencyLevel.SPACE:
      return 'Space';
    default:
      return 'Unknown';
  }
};

export const ProposalTransparencySettingsInfo = ({
  spaceDiscoverability,
  spaceActivityAccess,
}: ProposalTransparencySettingsInfoProps) => {
  if (spaceDiscoverability === undefined && spaceActivityAccess === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        Transparency Settings
      </span>
      <div className="flex flex-col gap-5">
        {spaceDiscoverability !== undefined && (
          <>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                Space Discoverability
              </div>
              <div className="text-1 text-nowrap">
                {getTransparencyLevelLabel(spaceDiscoverability)}
              </div>
            </div>
          </>
        )}
        {spaceActivityAccess !== undefined && (
          <>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                Space Activity Access
              </div>
              <div className="text-1 text-nowrap">
                {getTransparencyLevelLabel(spaceActivityAccess)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
