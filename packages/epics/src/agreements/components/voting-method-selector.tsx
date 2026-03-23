'use client';

import { Card } from '@hypha-platform/ui';
import clsx from 'clsx';
import { PlusCircledIcon } from '@radix-ui/react-icons';
import { useSpaceHasVoiceToken } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { VotingMethodType } from '@hypha-platform/core/client';
import { Tooltip } from 'react-tooltip';
import { useTranslations } from 'next-intl';

type VotingMethod = {
  id: VotingMethodType;
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: React.ReactNode;
};

type VotingMethodSelectorProps = {
  value?: VotingMethodType | null;
  onChange?: (value: VotingMethodType | null) => void;
  web3SpaceId?: number | null;
  hasVotingTokens?: boolean;
};

export const VotingMethodSelector = ({
  value,
  onChange,
  web3SpaceId,
  hasVotingTokens,
}: VotingMethodSelectorProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { lang, id } = useParams();
  const { hasVoiceToken } = useSpaceHasVoiceToken({
    spaceId: web3SpaceId ? BigInt(web3SpaceId) : BigInt(0),
  });

  if (!web3SpaceId) return null;

  const votingMethods: VotingMethod[] = [
    {
      id: '1m1v',
      title: tAgreementFlow('plugins.votingMethodSelector.oneMemberOneVoteTitle'),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneMemberOneVoteDescription',
      ),
      icon: <PlusCircledIcon />,
    },
    {
      id: '1v1v',
      title: tAgreementFlow('plugins.votingMethodSelector.oneVoiceOneVoteTitle'),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneVoiceOneVoteDescription',
      ),
      icon: <PlusCircledIcon />,
    },
    {
      id: '1t1v',
      title: tAgreementFlow('plugins.votingMethodSelector.oneTokenOneVoteTitle'),
      description: tAgreementFlow(
        'plugins.votingMethodSelector.oneTokenOneVoteDescription',
      ),
      icon: <PlusCircledIcon />,
    },
  ];

  const updatedVotingMethods = votingMethods
    .map((method) => {
      return {
        ...method,
        disabled: method.disabled,
      };
    })
    .map((method) => {
      if (method.id === '1v1v') {
        return {
          ...method,
          disabled: method.disabled || !hasVoiceToken,
          disabledTooltip: !hasVoiceToken ? (
            <div className="p-2">
              {tAgreementFlow('plugins.votingMethodSelector.voiceTokenTooltipPrefix')}{' '}
              <Link
                href={`/${lang}/dho/${id}/agreements/create/issue-new-token`}
                className="text-accent-9 underline"
                onClick={(e) => e.stopPropagation()}
              >
                {tAgreementFlow('plugins.votingMethodSelector.clickHere')}
              </Link>{' '}
              {tAgreementFlow('plugins.votingMethodSelector.voiceTokenTooltipSuffix')}
            </div>
          ) : undefined,
        };
      }

      if (method.id === '1t1v') {
        return {
          ...method,
          disabled: method.disabled || !hasVotingTokens,
          disabledTooltip: !hasVotingTokens ? (
            <div className="p-2">
              {tAgreementFlow('plugins.votingMethodSelector.tokenTooltipPrefix')}{' '}
              <Link
                href={`/${lang}/dho/${id}/agreements/create/issue-new-token`}
                className="text-accent-9 underline"
                onClick={(e) => e.stopPropagation()}
              >
                {tAgreementFlow('plugins.votingMethodSelector.clickHere')}
              </Link>{' '}
              {tAgreementFlow('plugins.votingMethodSelector.tokenTooltipSuffix')}
            </div>
          ) : undefined,
        };
      }

      return method;
    });

  const handleSelect = (id: VotingMethodType, disabled?: boolean) => {
    if (disabled) return;
    if (onChange) {
      onChange(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {updatedVotingMethods.map((method) => (
        <div key={method.id}>
          <Card
            data-tooltip-id={`tooltip-${method.id}`}
            data-tooltip-content={method.disabled ? '' : undefined}
            className={clsx(
              'flex p-5 cursor-pointer space-x-4 items-center border-2',
              {
                'border-accent-9': value === method.id,
                'opacity-50 cursor-not-allowed': method.disabled,
                'hover:border-accent-5': !method.disabled,
              },
            )}
            onClick={() => handleSelect(method.id, method.disabled)}
          >
            <div>{method.icon}</div>
            <div className="flex flex-col">
              <span className="text-3 font-medium">{method.title}</span>
              <span className="text-1 text-neutral-11">
                {method.description}
              </span>
            </div>
          </Card>

          {method.disabled && method.disabledTooltip && (
            <Tooltip
              id={`tooltip-${method.id}`}
              className="max-w-xs z-50"
              place="top"
              clickable={true}
            >
              {method.disabledTooltip}
            </Tooltip>
          )}
        </div>
      ))}
    </div>
  );
};
