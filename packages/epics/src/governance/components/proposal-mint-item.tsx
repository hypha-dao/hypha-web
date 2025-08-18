'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Skeleton } from '@hypha-platform/ui';

interface ProposalMintItemProps {
  member: `0x${string}`;
  number: bigint;
}

export const ProposalMintItem = ({ member, number }: ProposalMintItemProps) => {
  const originalNumber = Number(number) / Number(10n ** 18n);
  const { person, isLoading } = usePersonByWeb3Address(member);
  return (
    <div className="flex flex-col gap-3">
      <Skeleton loading={isLoading} className="h-7 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PersonAvatar avatarSrc={person?.avatarUrl} size="md" />
            <div className="text-1 w-full">
              {person?.name} {person?.surname}
            </div>
          </div>
          <div className="text-1">{Number(originalNumber).toFixed(2)}</div>
        </div>
      </Skeleton>
    </div>
  );
};
