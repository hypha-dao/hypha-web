'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Skeleton, Image } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useDbSpaces, useDbTokens } from '../../hooks';
import { EthAddress } from '../../people';
import { DbToken } from '@hypha-platform/core/server';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

interface ProposalBurnItemProps {
  member: `0x${string}` | null;
  number: bigint;
  token: `0x${string}`;
}

export const ProposalBurnItem = ({
  member,
  number,
  token,
}: ProposalBurnItemProps) => {
  const { spaces: dbSpaces } = useDbSpaces({
    parentOnly: false,
  });
  const { tokens: dbTokens } = useDbTokens();
  const originalNumber = Number(number) / Number(10n ** 18n);
  const isSelfBurn = member === ZERO_ADDRESS;
  const { person, isLoading } = usePersonByWeb3Address(
    (member ?? ZERO_ADDRESS) as `0x${string}`,
  );

  const space = dbSpaces.find(
    (s) => s.address?.toLowerCase() === member?.toLowerCase(),
  );
  const burnedToken = dbTokens.find(
    (t: DbToken) => t.address?.toLowerCase() === token?.toLowerCase(),
  );

  return (
    <div className="flex flex-col gap-3">
      <Skeleton loading={isLoading} className="h-7 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {isSelfBurn ? (
              <>
                <Image
                  className="rounded-lg w-[24px] h-[24px]"
                  src="/placeholder/default-profile.svg"
                  width={24}
                  height={24}
                  alt="Self burn"
                />
                <div className="text-1 w-full">Self burn</div>
              </>
            ) : person ? (
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
          <div className="text-1 flex gap-2 items-center">
            <Image
              className="rounded-full w-[24px] h-[24px]"
              src={
                burnedToken?.iconUrl ?? '/placeholder/neutral-token-icon.svg'
              }
              width={24}
              height={24}
              alt="Default avatar"
            />
            -{formatCurrencyValue(Number(originalNumber))}
            <span>{burnedToken?.symbol}</span>
          </div>
        </div>
      </Skeleton>
    </div>
  );
};
