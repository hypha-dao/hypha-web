'use client';

import { useTokens } from '../../treasury';
import { Token } from '@hypha-platform/core/client';
import { Image } from '@hypha-platform/ui';

interface ProposalVotingInfoProps {
  votingPowerSource: bigint;
  unity: bigint;
  quorum: bigint;
  token: {
    spaceId: bigint | undefined;
    token: `0x${string}` | '';
  };
  spaceSlug: string;
}

const getVotingMethodLabel = (source: bigint): string => {
  switch (source) {
    case 1n:
      return '1 Token 1 Vote';
    case 2n:
      return '1 Member 1 Vote';
    case 3n:
      return '1 Voice 1 Vote';
    default:
      return 'Unknown';
  }
};

export const ProposalVotingInfo = ({
  votingPowerSource,
  unity,
  quorum,
  token,
  spaceSlug,
}: ProposalVotingInfoProps) => {
  const { tokens } = useTokens({ spaceSlug });
  const parsedTokenData = tokens.find(
    (t: Token) => t.address.toLowerCase() === token.token?.toLowerCase(),
  );

  if (!token) return null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Voting Method</div>
        <div className="text-1 text-nowrap">
          {getVotingMethodLabel(votingPowerSource)}
        </div>
      </div>
      {parsedTokenData?.name && (
        <>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">Token Name</div>
            <div className="text-1 text-nowrap">{parsedTokenData?.name}</div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">Token Symbol</div>
            <div className="text-1">{parsedTokenData?.symbol}</div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">Token Icon</div>
            <Image
              className="rounded-full w-6 h-6"
              width={24}
              height={24}
              src={parsedTokenData?.icon || '/placeholder/token-icon.svg'}
              alt={`Token icon for ${parsedTokenData?.symbol}`}
            />
          </div>
        </>
      )}

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">Unity</div>
        <div>{unity.toString()}%</div>
      </div>

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">Quorum</div>
        <div>{quorum.toString()}%</div>
      </div>
    </div>
  );
};
