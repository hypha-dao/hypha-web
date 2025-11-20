'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Skeleton } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useDbSpaces } from '../../hooks';
import { EthAddress } from '../../people';
import { Image } from '@hypha-platform/ui';

interface ProposalMintItemProps {
  member: `0x${string}`;
  number: bigint;
}

export const ProposalMintItem = ({ member, number }: ProposalMintItemProps) => {
  const { spaces: dbSpaces } = useDbSpaces({
    parentOnly: false,
  });
  const originalNumber = Number(number) / Number(10n ** 18n);
  const { person, isLoading } = usePersonByWeb3Address(member);

  const space = dbSpaces.find(
    (s) => s.address?.toLowerCase() === member.toLowerCase(),
  );

  return (
    <div className="flex flex-col gap-3">
      <Skeleton loading={isLoading} className="h-7 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {person ? (
              <>
                <PersonAvatar avatarSrc={person?.avatarUrl} size="md" />
                <div className="text-1 w-full">
                  {person?.name} {person?.surname}
                </div>
              </>
            ) : space ? (
              <>
                <Image
                  className="rounded-lg w-[24px] h-[24px]"
                  src={space?.logoUrl ?? '/placeholder/default-profile.svg'}
                  width={24}
                  height={24}
                  alt={`${space?.title} logo`}
                />
                <div className="text-1 w-full">{space?.title}</div>
              </>
            ) : (
              <>
                <Image
                  className="rounded-lg w-[24px] h-[24px]"
                  src="/placeholder/default-profile.svg"
                  width={24}
                  height={24}
                  alt="Default avatar"
                />
                <div className="text-1 w-full">
                  <EthAddress address={member} />
                </div>
              </>
            )}
          </div>
          <div className="text-1">
            {formatCurrencyValue(Number(originalNumber))}
          </div>
        </div>
      </Skeleton>
    </div>
  );
};
