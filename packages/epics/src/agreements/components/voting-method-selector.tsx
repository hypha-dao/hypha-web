'use client';

import { Card } from '@hypha-platform/ui';
import clsx from 'clsx';
import { PlusCircledIcon } from '@radix-ui/react-icons';
import { useSpaceHasVoiceToken } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { VotingMethodType } from '@hypha-platform/core/client';
import { Tooltip } from 'react-tooltip';

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
    description:
      'Each member has an equal say in decisions, with no weighting by role, tokens, or stake, ensuring equality and shared power. Commonly used in community or ecosystem spaces.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1v1v',
    title: '1 Voice 1 Vote',
    description:
      'Each vote is tied to earned voice tokens, reflecting contributions, reputation, and commitment, but decays with inactivity to encourage engagement. Commonly used in core teams or contributor groups.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1t1v',
    title: '1 Token 1 Vote',
    description:
      'Voting power is proportional to the number of tokens held, aligning influence with stake. Commonly used in value flows, treasury, or investment spaces.',
    icon: <PlusCircledIcon />,
  },
];

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
  const { lang, id } = useParams();
  const { hasVoiceToken } = useSpaceHasVoiceToken({
    spaceId: web3SpaceId ? BigInt(web3SpaceId) : BigInt(0),
  });

  if (!web3SpaceId) return null;

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
              To select this voting method you first need to issue your Voice
              Token.{' '}
              <Link
                href={`/${lang}/dho/${id}/agreements/create/issue-new-token`}
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
              To select this voting method, you first need to issue a token.{' '}
              <Link
                href={`/${lang}/dho/${id}/agreements/create/issue-new-token`}
                className="text-accent-9 underline"
                onClick={(e) => e.stopPropagation()}
              >
                Click here
              </Link>{' '}
              to create your token
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
