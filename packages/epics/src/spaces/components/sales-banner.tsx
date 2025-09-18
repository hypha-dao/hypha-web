'use client';

import { Card, Button } from '@hypha-platform/ui';
import { useSalesBanner, useJoinSpace } from '../hooks';
import { Cross1Icon } from '@radix-ui/react-icons';
import { usePathname } from 'next/navigation';
import { cleanPath } from '../utils/cleanPath';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';

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
  const { isAuthenticated } = useAuthentication();

  if (isLoading || !status) {
    return null;
  }

  const isDisabled = !isAuthenticated || !isMember;
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember
    ? 'Please join this space to use this feature.'
    : '';

  const bannerStates: Record<
    'trial' | 'beforeExpiry' | 'expired',
    BannerState
  > = {
    trial: {
      title: `Only ${daysLeft} days left in your free trial!`,
      subtitle: 'Unlock full access and keep your progress going',
      actionText: 'Activate Now',
    },
    beforeExpiry: {
      title: `Only ${daysLeft} days left on your Hypha Network Contribution!`,
      subtitle: 'Don’t lose access to your Space features',
      actionText: 'Renew Now',
    },
    expired: {
      title: `Your Space has been expired for ${Math.abs(daysLeft)} days!`,
      subtitle: 'Reactivate now to regain access to your Space features',
      actionText: 'Reactivate Now',
    },
  };

  const { title, subtitle, actionText } = bannerStates[status];

  return (
    <Card
      className="bg-cover bg-center"
      style={{ backgroundImage: 'url("/placeholder/sales-banner-bg.png")' }}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-6 font-medium">{title}</span>
          <Button
            onClick={onClose}
            variant="ghost"
            className="rounded-full w-fit text-white"
          >
            <Cross1Icon width={16} height={16} />
          </Button>
        </div>
        <span className="text-2 text-neutral-11">{subtitle}</span>

        <Link
          title={tooltipMessage || ''}
          className={isDisabled ? 'cursor-not-allowed' : ''}
          href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}
        >
          <Button disabled={isDisabled} className="w-fit">
            {actionText}
          </Button>
        </Link>
      </div>
    </Card>
  );
};
