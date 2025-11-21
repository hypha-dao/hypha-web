'use client';

import { usePersonByWeb3Address } from '../hooks';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Skeleton } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useDbSpaces } from '../../hooks';
import { EthAddress } from '../../people';
import { Image } from '@hypha-platform/ui';
import { useDbTokens } from '../../hooks';
import { DbToken } from '@hypha-platform/core/server';

interface ProposalMintItemProps {
  member: `0x${string}`;
  number: bigint;
  token: `0x${string}`;
}

export const ProposalMintItem = ({
  member,
  number,
  token,
}: ProposalMintItemProps) => {
  const { spaces: dbSpaces } = useDbSpaces({
    parentOnly: false,
  });
  const { tokens: dbTokens } = useDbTokens();
  const originalNumber = Number(number) / Number(10n ** 18n);
  const { person, isLoading } = usePersonByWeb3Address(member);

  const space = dbSpaces.find(
    (s) => s.address?.toLowerCase() === member.toLowerCase(),
  );
  const mintedToken = dbTokens.find(
    (t: DbToken) => t.address?.toLowerCase() === token?.toLowerCase(),
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
          <div className="text-1 flex gap-2 items-center">
            <Image
              className="rounded-full w-[24px] h-[24px]"
              src={mintedToken?.iconUrl ?? 'placeholder/neutral-token-icon.svg'}
              width={24}
              height={24}
              alt="Default avatar"
            />
            {formatCurrencyValue(Number(originalNumber))}
            <span>{mintedToken?.symbol}</span>
          </div>
        </div>
      </Skeleton>
    </div>
  );
};
