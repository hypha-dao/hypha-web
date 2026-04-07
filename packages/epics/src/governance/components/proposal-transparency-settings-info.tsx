'use client';

import { TransparencyLevel } from '../../spaces/components/transparency-level';
import { useTranslations } from 'next-intl';

interface ProposalTransparencySettingsInfoProps {
  spaceDiscoverability?: TransparencyLevel;
  spaceActivityAccess?: TransparencyLevel;
}

const getTransparencyLevelLabel = (
  level: TransparencyLevel | undefined,
  tProposalDetails: any,
): string => {
  if (level === undefined) return tProposalDetails('labels.unknown');

  switch (level) {
    case TransparencyLevel.PUBLIC:
      return tProposalDetails('transparencyLevel.public');
    case TransparencyLevel.NETWORK:
      return tProposalDetails('transparencyLevel.network');
    case TransparencyLevel.ORGANISATION:
      return tProposalDetails('transparencyLevel.organisation');
    case TransparencyLevel.SPACE:
      return tProposalDetails('transparencyLevel.space');
    default:
      return tProposalDetails('labels.unknown');
  }
};

export const ProposalTransparencySettingsInfo = ({
  spaceDiscoverability,
  spaceActivityAccess,
}: ProposalTransparencySettingsInfoProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  if (spaceDiscoverability === undefined && spaceActivityAccess === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">
        {tProposalDetails('sections.transparencySettings')}
      </span>
      <div className="flex flex-col gap-5">
        {spaceDiscoverability !== undefined && (
          <>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.spaceDiscoverability')}
              </div>
              <div className="text-1 text-nowrap">
                {getTransparencyLevelLabel(
                  spaceDiscoverability,
                  tProposalDetails,
                )}
              </div>
            </div>
          </>
        )}
        {spaceActivityAccess !== undefined && (
          <>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.spaceActivityAccess')}
              </div>
              <div className="text-1 text-nowrap">
                {getTransparencyLevelLabel(
                  spaceActivityAccess,
                  tProposalDetails,
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
