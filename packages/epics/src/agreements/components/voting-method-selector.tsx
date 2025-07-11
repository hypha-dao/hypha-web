'use client';

import { Card } from '@hypha-platform/ui';
import clsx from 'clsx';
import { PlusCircledIcon } from '@radix-ui/react-icons';
import { useSpaceHasVoiceToken, useTokensVotingPower } from '@core/space';
import { Tooltip, TooltipTrigger, TooltipContent } from '@hypha-platform/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { VotingMethodType } from '@core/governance/client';

type VotingMethod = {
  id: VotingMethodType;
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: React.ReactNode;
};

const votingMethods: VotingMethod[] = [
  {
    id: '1m1v',
    title: '1 Member 1 Vote',
    description: 'Each member has an equal say, regardless of token holdings.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1v1v',
    title: '1 Voice 1 Vote',
    description: 'Votes are distributed based on membership or reputation.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1t1v',
    title: '1 Token 1 Vote',
    description: 'Voting power is proportional to the number of tokens held.',
    icon: <PlusCircledIcon />,
  },
];

type VotingMethodSelectorProps = {
  value?: VotingMethodType | null;
  onChange?: (value: VotingMethodType | null) => void;
  web3SpaceId?: number | null;
};

export const VotingMethodSelector = ({
  value,
  onChange,
  web3SpaceId,
}: VotingMethodSelectorProps) => {
  const { lang, id } = useParams();
  const { hasVoiceToken } = useSpaceHasVoiceToken({
    spaceId: web3SpaceId ? BigInt(web3SpaceId) : BigInt(0),
  });
  const { hasVotingTokens } = useTokensVotingPower({
    spaceId: web3SpaceId ? BigInt(web3SpaceId) : BigInt(0),
  });

  if (!web3SpaceId) return null;

  const updatedVotingMethods = votingMethods
    .map((method) => {
      return {
        ...method,
        disabled: method.disabled || method.id === value,
      };
    })
    .map((method) => {
      if (method.id === '1v1v') {
        return {
          ...method,
          disabled: method.disabled || !hasVoiceToken,
          disabledTooltip: !hasVoiceToken ? (
            <div className="p-2">
              To select this voting method you first need to issue your Voice
              Token.{' '}
              <Link
                href={`/${lang}/dho/${id}/treasury/create/issue-new-token`}
                className="text-accent-9 underline"
                onClick={(e) => e.stopPropagation()}
              >
                Click here
              </Link>{' '}
              to create your Voice Token
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
              To select this voting method you first need to issue your Reqular
              Token (with enabled <strong>Is Voting Token</strong> option).{' '}
              <Link
                href={`/${lang}/dho/${id}/treasury/create/issue-new-token`}
                className="text-accent-9 underline"
                onClick={(e) => e.stopPropagation()}
              >
                Click here
              </Link>{' '}
              to create your Regular Token
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
        <Tooltip key={method.id}>
          <TooltipTrigger asChild>
            <Card
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
          </TooltipTrigger>
          {method.disabled && method.disabledTooltip && (
            <TooltipContent>{method.disabledTooltip}</TooltipContent>
          )}
        </Tooltip>
      ))}
    </div>
  );
};
