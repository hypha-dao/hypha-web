'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceMember } from '../../spaces';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

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

type BannerStateKey =
  | 'noParticipation'
  | 'insufficientParticipation'
  | 'lackAlignment'
  | 'approved'
  | 'insufficientParticipationAndAlignment';

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
  const tCommon = useTranslations('Common');
  const tProposalDetails = useTranslations('ProposalDetails');
  const [localActionCompleted, setLocalActionCompleted] = useState(false);

  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: web3SpaceId as number,
  });
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
    isMemberLoading ||
    (!isMember && !isDelegate) ||
    isExpiring ||
    localActionCompleted;
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : isMemberLoading
    ? tProposalDetails('expireBanner.checkingMembership')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : isExpiring
    ? tProposalDetails('expireBanner.processing')
    : localActionCompleted
    ? tProposalDetails('expireBanner.actionCompleted')
    : '';

  const getBannerStateKey = (): BannerStateKey => {
    if (quorumPercentage === 0 && unityPercentage === 0) {
      return 'noParticipation';
    }

    if (!quorumReached && unityReached) {
      return 'insufficientParticipation';
    }

    if (quorumReached && !unityReached) {
      return 'lackAlignment';
    }

    if (quorumReached && unityReached) {
      return 'approved';
    }

    return 'insufficientParticipationAndAlignment';
  };

  const stateKey = getBannerStateKey();
  const title = tProposalDetails('expireBanner.title');
  const subtitle =
    stateKey === 'noParticipation'
      ? tProposalDetails('expireBanner.states.noParticipation.subtitle')
      : stateKey === 'insufficientParticipation'
      ? tProposalDetails(
          'expireBanner.states.insufficientParticipation.subtitle',
        )
      : stateKey === 'lackAlignment'
      ? tProposalDetails('expireBanner.states.lackAlignment.subtitle')
      : stateKey === 'approved'
      ? tProposalDetails('expireBanner.states.approved.subtitle')
      : tProposalDetails(
          'expireBanner.states.insufficientParticipationAndAlignment.subtitle',
        );
  const completedMessage =
    stateKey === 'noParticipation'
      ? tProposalDetails('expireBanner.states.noParticipation.completedMessage')
      : stateKey === 'insufficientParticipation'
      ? tProposalDetails(
          'expireBanner.states.insufficientParticipation.completedMessage',
        )
      : stateKey === 'lackAlignment'
      ? tProposalDetails('expireBanner.states.lackAlignment.completedMessage')
      : stateKey === 'approved'
      ? tProposalDetails('expireBanner.states.approved.completedMessage')
      : tProposalDetails(
          'expireBanner.states.insufficientParticipationAndAlignment.completedMessage',
        );
  const buttonText = isExpiring
    ? tProposalDetails('expireBanner.processing')
    : tProposalDetails('expireBanner.confirmDecision');

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
    <div className="border-1 rounded-[8px] bg-accent-surface bg-center border-accent-6">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-2 font-bold text-foreground">{title}</span>
        </div>

        {showCompletedMessage ? (
          <>
            <span className={cn('text-2', 'text-foreground')}>
              {completedMessage}
            </span>
          </>
        ) : (
          <>
            <span className={cn('text-2', 'text-foreground')}>{subtitle}</span>
            {isExpiring ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                {tProposalDetails('expireBanner.processing')}
              </div>
            ) : (
              <Button
                disabled={isDisabled}
                title={tooltipMessage}
                onClick={handleAction}
                variant="outline"
                colorVariant="accent"
                className="w-fit"
              >
                {buttonText}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
