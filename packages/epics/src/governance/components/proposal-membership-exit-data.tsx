'use client';

import { Image } from '@hypha-platform/ui';
import { usePersonByWeb3Address, useSpacesByWeb3IdsClient } from '../hooks';
import { useDbSpaces } from '../../hooks';
import { EthAddress } from '../../people';

interface MembershipExitDataProps {
  member?: string;
  space?: bigint;
}

export const MembershipExitData = ({
  member,
  space,
}: MembershipExitDataProps) => {
  const { person } = usePersonByWeb3Address(member as `0x${string}`);
  const { spaces } = useSpacesByWeb3IdsClient([space as bigint]);
  const destructuredSpace = spaces?.[0];
  const { spaces: dbSpaces } = useDbSpaces({
    parentOnly: false,
  });
  const exitingMemberSpace = dbSpaces.find(
    (s) => s.address?.toLowerCase() === member?.toLowerCase(),
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">Exiting Member</span>
        {person ? (
          <span className="flex gap-2 text-2 text-neutral-11">
            <Image
              className="rounded-lg w-[24px] h-[24px]"
              src={person?.avatarUrl ?? '/placeholder/default-profile.svg'}
              width={24}
              height={24}
              alt={`${person?.nickname} avatar`}
            />
            <span className="text-nowrap">
              {person?.name} {person?.surname}
            </span>
          </span>
        ) : exitingMemberSpace ? (
          <span className="flex gap-2 text-2 text-neutral-11">
            <Image
              className="rounded-lg w-[24px] h-[24px]"
              src={
                exitingMemberSpace?.logoUrl ??
                '/placeholder/default-profile.svg'
              }
              width={24}
              height={24}
              alt={`${exitingMemberSpace?.title} logo`}
            />
            <span className="text-nowrap">{exitingMemberSpace?.title}</span>
          </span>
        ) : (
          <EthAddress address={member || ''} />
        )}
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">Exit From</span>
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
    </div>
  );
};
