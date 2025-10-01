'use client';

import { Card, Button } from '@hypha-platform/ui';
import { Cross1Icon } from '@radix-ui/react-icons';
import { useTheme } from 'next-themes';
import { cn } from '@hypha-platform/ui-utils';
import { useMFABanner } from '../hooks/useMFABanner';

export const MFABanner = () => {
  const { resolvedTheme } = useTheme();
  const { onClose, isVisible, showMfaEnrollmentModal } = useMFABanner();

  if (!isVisible) {
    return null;
  }

  const title = 'Protect your funds';
  const description =
    'Secure your wallet with Multi-Factor Authentication (MFA). Even if your password is compromised, a second verification step ensures only you can access your funds.';

  return (
    <Card
      className="bg-cover bg-center"
      style={{ backgroundImage: 'url("/placeholder/sales-banner-bg.png")' }}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-6 font-medium text-white">{title}</span>
          <Button
            onClick={onClose}
            variant="ghost"
            className="rounded-full w-fit text-white"
          >
            <Cross1Icon width={16} height={16} />
          </Button>
        </div>
        <span
          className={cn(
            'text-2',
            resolvedTheme === 'dark' ? 'text-neutral-11' : 'text-white',
          )}
        >
          {description}
        </span>

        <Button onClick={showMfaEnrollmentModal} className="w-fit">
          Activate MFA
        </Button>
      </div>
    </Card>
  );
};
