'use client';

import { usePersonByWeb3Address, useSpacesByWeb3IdsClient } from '../hooks';
import { Image } from '@hypha-platform/ui';

interface ProposalDelegatesDataProps {
  member?: string;
  space?: bigint;
}

export const ProposalDelegatesData = ({
  member,
  space,
}: ProposalDelegatesDataProps) => {
  const { person } = usePersonByWeb3Address(member as `0x${string}`);
  const { spaces } = useSpacesByWeb3IdsClient([space as bigint]);
  const destructuredSpace = spaces?.[0];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">Joining Space</span>
        <span className="flex gap-2 text-2 text-neutral-11">
          <Image
            className="w-[24px] h-[24px] rounded-lg"
            src={
              destructuredSpace?.logoUrl ??
              '/placeholder/space-avatar-image.svg'
            }
            width={24}
            height={24}
            alt={`${destructuredSpace?.title} logo`}
          />
          <span>{destructuredSpace?.title}</span>
        </span>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">Delegated Voting Member</span>
        <span className="flex gap-2 text-2 text-neutral-11">
          <Image
            className="rounded-lg"
            src={person?.avatarUrl ?? '/placeholder/default-profile.svg'}
            width={24}
            height={24}
            alt={`${person?.nickname} avatar`}
          />
          <span>
            {person?.name} {person?.surname}
          </span>
        </span>
      </div>
    </div>
  );
};
