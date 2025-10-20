'use client';

import { useTokens } from '../../treasury';
import { Token } from '@hypha-platform/core/client';
import { Image } from '@hypha-platform/ui';
import { formatDuration } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';

interface ProposalVotingInfoProps {
  votingPowerSource: bigint;
  unity: bigint;
  quorum: bigint;
  token: {
    spaceId: bigint | undefined;
    token: `0x${string}` | '';
  };
  spaceSlug: string;
  minimumProposalVotingDuration?: bigint;
}

const TEMPLATES = [
  { title: '80-20 Pareto', quorum: 20, unity: 80 },
  { title: 'Majority Vote', quorum: 51, unity: 51 },
  { title: 'Minority Vote', quorum: 10, unity: 90 },
  { title: 'Consensus', quorum: 100, unity: 100 },
  { title: 'Consent', quorum: 0, unity: 100 },
  { title: 'Hearing', quorum: 100, unity: 0 },
];

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
  minimumProposalVotingDuration,
}: ProposalVotingInfoProps) => {
  const { tokens } = useTokens({ spaceSlug });
  const parsedTokenData = tokens.find(
    (t: Token) => t.address.toLowerCase() === token.token?.toLowerCase(),
  );

  if (!token) return null;

  const getVotingMethod = (quorum: bigint, unity: bigint): string => {
    const q = Number(quorum);
    const u = Number(unity);

    const found = TEMPLATES.find(
      (template) => template.quorum === q && template.unity === u,
    );

    return found?.title || 'Custom';
  };

  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Voting Method</div>
        <div className="text-1 text-nowrap">
          {getVotingMethod(quorum, unity)}
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
        <div className="w-full">Quorum</div>
        <div>{quorum.toString()}%</div>
      </div>

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">Unity</div>
        <div>{unity.toString()}%</div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11">Voting Period</div>
        <div className="text-1 text-nowrap">
          {Number(minimumProposalVotingDuration) > 0 ? (
            <span className="flex items-center gap-2">
              <Image
                className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                width={24}
                height={24}
                src={
                  theme === 'light'
                    ? '/placeholder/non-auto-execution-icon-light.svg'
                    : '/placeholder/non-auto-execution-icon.svg'
                }
                alt="Proposal minimum voting icon"
              />{' '}
              {formatDuration(Number(minimumProposalVotingDuration))} to Vote
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Image
                className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                width={24}
                height={32}
                src={
                  theme === 'light'
                    ? '/placeholder/auto-execution-icon-light.svg'
                    : '/placeholder/auto-execution-icon.svg'
                }
                alt="Proposal minimum voting icon"
              />
              Auto-Execution
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Voting Power</div>
        <div className="text-1 text-nowrap">
          {getVotingMethodLabel(votingPowerSource)}
        </div>
      </div>
    </div>
  );
};
