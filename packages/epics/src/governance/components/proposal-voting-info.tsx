'use client';

import { useTokens } from '../../treasury';
import { Token } from '@hypha-platform/core/client';
import { Image } from '@hypha-platform/ui';
import { getDurationParts } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';
import { VOTING_METHOD_TEMPLATES } from '../hooks';
import { useTranslations } from 'next-intl';

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

const getVotingMethodLabel = (
  source: bigint,
  tProposalDetails: any,
): string => {
  switch (source) {
    case 1n:
      return tProposalDetails('votingPower.oneTokenOneVote');
    case 2n:
      return tProposalDetails('votingPower.oneMemberOneVote');
    case 3n:
      return tProposalDetails('votingPower.oneVoiceOneVote');
    default:
      return tProposalDetails('labels.unknown');
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
  const tProposalDetails = useTranslations('ProposalDetails');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCommon = useTranslations('Common');
  const { tokens } = useTokens({ spaceSlug });
  const parsedTokenData = tokens.find(
    (t: Token) => t.address.toLowerCase() === token.token?.toLowerCase(),
  );

  if (!token) return null;

  const getVotingMethod = (quorum: bigint, unity: bigint): string => {
    const q = Number(quorum);
    const u = Number(unity);

    const found = VOTING_METHOD_TEMPLATES.find(
      (template) => template.quorum === q && template.unity === u,
    );

    if (found?.titleKey) {
      const translationKey =
        `plugins.quorumAndUnity.templates.${found.titleKey}` as Parameters<
          typeof tAgreementFlow
        >[0];
      return tAgreementFlow(translationKey);
    }

    return tProposalDetails('labels.custom');
  };

  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.votingMethod')}
        </div>
        <div className="text-1 text-nowrap">
          {getVotingMethod(quorum, unity)}
        </div>
      </div>

      {parsedTokenData?.name && (
        <>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">
              {tProposalDetails('labels.tokenName')}
            </div>
            <div className="text-1 text-nowrap">{parsedTokenData?.name}</div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">
              {tProposalDetails('labels.tokenSymbol')}
            </div>
            <div className="text-1">{parsedTokenData?.symbol}</div>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-1 text-neutral-11 w-full">
              {tProposalDetails('labels.tokenIcon')}
            </div>
            <Image
              className="rounded-full w-6 h-6"
              width={24}
              height={24}
              src={parsedTokenData?.icon || '/placeholder/token-icon.svg'}
              alt={tProposalDetails('labels.tokenIconFor', {
                symbol: parsedTokenData?.symbol ?? '',
              })}
            />
          </div>
        </>
      )}
      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">{tProposalDetails('labels.quorum')}</div>
        <div>{quorum.toString()}%</div>
      </div>

      <div className="flex justify-between items-center text-1 text-neutral-11">
        <div className="w-full">{tProposalDetails('labels.unity')}</div>
        <div>{unity.toString()}%</div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11">
          {tProposalDetails('labels.votingPeriod')}
        </div>
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
                alt={tProposalDetails('voting.proposalVotingIconAlt')}
              />{' '}
              {tProposalDetails('voting.toVote', {
                duration: (() => {
                  const { unit, count } = getDurationParts(
                    Number(minimumProposalVotingDuration),
                  );
                  return tCommon(
                    unit === 'hours' ? 'durationHours' : 'durationDays',
                    { count },
                  );
                })(),
              })}
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
                alt={tProposalDetails('voting.proposalVotingIconAlt')}
              />
              {tProposalDetails('voting.autoExecution')}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.votingPower')}
        </div>
        <div className="text-1 text-nowrap">
          {getVotingMethodLabel(votingPowerSource, tProposalDetails)}
        </div>
      </div>
    </div>
  );
};
