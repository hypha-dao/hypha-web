'use client';

import { Card, Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useJoinSpace } from '../../spaces';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ExpireProposalBannerProps {
  quorumReached?: boolean;
  unityReached?: boolean;
  onHandleAction?: () => void;
  isDisplay?: boolean;
  isActionCompleted?: boolean;
  isExpiring?: boolean;
  web3SpaceId?: number;
  quorumPercentage?: number;
  unityPercentage?: number;
}

type BannerState = {
  title: string;
  subtitle: string;
  buttonText: string;
  completedMessage: string;
};

export const ExpireProposalBanner = ({
  quorumReached,
  unityReached,
  onHandleAction,
  isDisplay,
  isActionCompleted = false,
  isExpiring = false,
  web3SpaceId,
  quorumPercentage = 0,
  unityPercentage = 0,
}: ExpireProposalBannerProps) => {
  const [localActionCompleted, setLocalActionCompleted] = useState(false);

  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { isAuthenticated } = useAuthentication();

  useEffect(() => {
    setLocalActionCompleted(false);
  }, [quorumPercentage, unityPercentage, quorumReached, unityReached]);

  if (!isDisplay) {
    return null;
  }

  const isDisabled =
    !isAuthenticated ||
    (!isMember && !isDelegate) ||
    isExpiring ||
    localActionCompleted;
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember && !isDelegate
    ? 'Please join this space to use this feature.'
    : isExpiring
    ? 'Processing...'
    : localActionCompleted
    ? 'Action completed'
    : '';

  const getBannerState = (): BannerState => {
    if (quorumPercentage === 0 && unityPercentage === 0) {
      return {
        title: 'The voting period has ended.',
        subtitle:
          'No votes were recorded for this proposal. Without any participation, this proposal will be rejected.',
        buttonText: isExpiring ? 'Processing...' : 'Confirm Decision',
        completedMessage:
          'Decision recorded: Proposal rejected due to no participation.',
      };
    }

    if (!quorumReached && unityReached) {
      return {
        title: 'The voting period has ended.',
        subtitle:
          'Participation was too low for this proposal to be approved. This proposal will be rejected.',
        buttonText: isExpiring ? 'Processing...' : 'Confirm Decision',
        completedMessage:
          'Decision recorded: Proposal rejected due to insufficient participation.',
      };
    }

    if (quorumReached && !unityReached) {
      return {
        title: 'The voting period has ended.',
        subtitle:
          'Participation was sufficient, but support was too divided. This proposal will be rejected.',
        buttonText: isExpiring ? 'Processing...' : 'Confirm Decision',
        completedMessage:
          'Decision recorded: Proposal rejected due to lack of alignment.',
      };
    }

    if (quorumReached && unityReached) {
      return {
        title: 'The voting period has ended.',
        subtitle:
          'This proposal has met all requirements and is approved as a new agreement.',
        buttonText: isExpiring ? 'Processing...' : 'Confirm Decision',
        completedMessage:
          'Decision recorded: Proposal approved and moved to the Accepted section.',
      };
    }

    return {
      title: 'The voting period has ended.',
      subtitle:
        'Participation was too low, and support was too divided. This proposal will be rejected.',
      buttonText: isExpiring ? 'Processing...' : 'Confirm Decision',
      completedMessage:
        'Decision recorded: Proposal rejected due to insufficient participation and lack of alignment.',
    };
  };

  const { title, subtitle, buttonText, completedMessage } = getBannerState();

  const handleAction = async () => {
    if (onHandleAction && !isExpiring && !localActionCompleted) {
      try {
        await onHandleAction();
        setLocalActionCompleted(true);
      } catch (error) {
        console.error('Error handling action:', error);
        setLocalActionCompleted(false);
      }
    }
  };

  const showCompletedMessage = isActionCompleted || localActionCompleted;

  return (
    <Card
      className="bg-cover bg-center"
      style={{ backgroundImage: 'url("/placeholder/sales-banner-bg.png")' }}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-6 font-medium text-white">{title}</span>
        </div>

        {showCompletedMessage ? (
          <>
            <span className={cn('text-2', 'text-white')}>
              {completedMessage}
            </span>
          </>
        ) : (
          <>
            <span className={cn('text-2', 'text-white')}>{subtitle}</span>
            {isExpiring ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                Processing...
              </div>
            ) : (
              <Button
                disabled={isDisabled}
                title={tooltipMessage}
                onClick={handleAction}
                className="w-fit"
              >
                {buttonText}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
