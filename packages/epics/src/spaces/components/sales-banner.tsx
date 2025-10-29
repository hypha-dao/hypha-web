'use client';

import { Button } from '@hypha-platform/ui';
import { useSalesBanner, useJoinSpace } from '../hooks';
import { Cross1Icon } from '@radix-ui/react-icons';
import { usePathname } from 'next/navigation';
import { cleanPath } from '../utils/cleanPath';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useIsDelegate } from '@hypha-platform/core/client';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface BannerState {
  title: string;
  subtitle: string;
  actionText: string;
}

interface SalesBannerProps {
  web3SpaceId?: number;
}

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

export const SalesBanner = ({ web3SpaceId }: SalesBannerProps) => {
  const pathname = usePathname();
  const { status, daysLeft, onClose, isLoading } = useSalesBanner({
    spaceId: web3SpaceId,
  });
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { isAuthenticated } = useAuthentication();

  if (isLoading || !status) {
    return null;
  }

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember && !isDelegate
    ? 'Please join this space to use this feature.'
    : '';

  const bannerStates: Record<
    'trial' | 'beforeExpiry' | 'expired',
    BannerState
  > = {
    trial: {
      title: `Only ${daysLeft} days left in your free trial!`,
      subtitle:
        'Contribute $11 per month in USDC or Hypha tokens to the Hypha Network to unlock full access for your Space and keep your progress going!',
      actionText: 'Activate Now',
    },
    beforeExpiry: {
      title: `Only ${daysLeft} days left before your Hypha Network contribution expires!`,
      subtitle:
        'Don’t lose access to your Space features! Renew now by contributing $11 per month in USDC or Hypha tokens to the Hypha Network.',
      actionText: 'Renew Now',
    },
    expired: {
      title: `Your Hypha Network contribution expired ${Math.abs(
        daysLeft,
      )} days ago!`,
      subtitle:
        'Reactivate now by contributing $11 per month in USDC or Hypha tokens to the Hypha Network and regain access to all your Space features.',
      actionText: 'Reactivate Now',
    },
  };

  const { title, subtitle, actionText } = bannerStates[status];

  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center justify-between">
      <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto">
        <ExclamationTriangleIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-2 text-foreground font-bold">{title}</span>
          <span className="text-2 text-foreground">{subtitle}</span>
        </div>
      </div>
      <div className="flex gap-2 w-full md:w-auto justify-between md:justify-normal">
        <Link
          title={tooltipMessage || ''}
          className={
            isDisabled
              ? 'cursor-not-allowed flex-1 md:flex-auto'
              : 'flex-1 md:flex-auto'
          }
          href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}
        >
          <Button
            disabled={isDisabled}
            className="w-full md:w-fit text-wrap justify-center"
          >
            {actionText}
          </Button>
        </Link>
        <Button
          onClick={onClose}
          variant="ghost"
          className="rounded-full w-fit text-foreground flex-shrink-0"
        >
          <Cross1Icon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
};
