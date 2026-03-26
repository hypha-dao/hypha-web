'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Skeleton, Image } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useDbSpaces, useDbTokens } from '../../hooks';
import { EthAddress } from '../../people';
import { DbToken } from '@hypha-platform/core/server';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const TOKEN_DECIMALS_BY_ADDRESS: Record<string, number> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6,
  '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42': 6,
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8,
};

const resolveTokenDecimals = (tokenAddress?: string) => {
  if (!tokenAddress) return 18;
  return TOKEN_DECIMALS_BY_ADDRESS[tokenAddress.toLowerCase()] ?? 18;
};

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
  const decimals = resolveTokenDecimals(token);
  const originalNumber = Number(number) / Number(10n ** BigInt(decimals));
  const isSelfBurn = member === null || member === ZERO_ADDRESS;
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
                  <EthAddress address={member ?? ZERO_ADDRESS} />
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
