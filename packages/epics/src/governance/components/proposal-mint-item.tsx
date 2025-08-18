'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';

interface ProposalMintItemProps {
  member: `0x${string}`;
  number: bigint;
}

export const ProposalMintItem = ({ member, number }: ProposalMintItemProps) => {
  const originalNumber = Number(number) / Number(10n ** 18n);
  const { person } = usePersonByWeb3Address(member);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <PersonAvatar avatarSrc={person.avatarUrl ?? ''} size="md" />
          <div className="text-1 w-full">
            {person.name} {person.surname}
          </div>
        </div>
        <div className="text-1">{Number(originalNumber).toFixed(2)}</div>
      </div>
    </div>
  );
};
