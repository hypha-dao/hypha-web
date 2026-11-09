'use client';

import { useTranslations } from 'next-intl';

interface ProposalEntryInfoProps {
  joinMethod: bigint;
}

const getEntryMethodLabel = (method: bigint, tProposalDetails: any): string => {
  switch (method) {
    case 0n:
      return tProposalDetails('entryMethods.openAccess');
    case 1n:
      return tProposalDetails('entryMethods.tokenBased');
    case 2n:
      return tProposalDetails('entryMethods.inviteOnly');
    default:
      return tProposalDetails('labels.unknown');
  }
};

export const ProposalEntryInfo = ({ joinMethod }: ProposalEntryInfoProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full font-bold">
          {tProposalDetails('labels.entryMethod')}
        </div>
        <div className="text-1 text-nowrap">
          {getEntryMethodLabel(joinMethod, tProposalDetails)}
        </div>
      </div>
    </div>
  );
};
