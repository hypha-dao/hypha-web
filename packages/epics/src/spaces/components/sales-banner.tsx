import { Card, Button } from '@hypha-platform/ui';
import { useSalesBanner } from '../hooks';
import { Cross1Icon } from '@radix-ui/react-icons';

interface BannerState {
  title: string;
  subtitle: string;
  actionText: string;
}

interface SalesBannerProps {}

export const SalesBanner = ({}: SalesBannerProps) => {
  const { status, daysLeft, onClose } = useSalesBanner();

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
      title: `Your Space has been expired for ${daysLeft} days!`,
      subtitle: 'Reactivate now to regain access to your Space features',
      actionText: 'Reactivate Now',
    },
  };

  const currentState = bannerStates[status] || {
    title: 'Unknown status',
    subtitle: 'Please check your subscription status',
    actionText: 'Check Now',
  };

  const { title, subtitle, actionText } = currentState;

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
        <Button className="w-fit">{actionText}</Button>
      </div>
    </Card>
  );
};
