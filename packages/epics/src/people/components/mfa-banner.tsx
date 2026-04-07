'use client';

import { Button } from '@hypha-platform/ui';
import { Cross1Icon, LockClosedIcon } from '@radix-ui/react-icons';
import { useMFABanner } from '../hooks/useMFABanner';

export const MFABanner = () => {
  const { onClose, isVisible, showMfaEnrollmentModal } = useMFABanner();

  if (!isVisible) return null;

  const title = 'Protect your funds';
  const subtitle =
    'Secure your wallet with Multi-Factor Authentication (MFA). Even if your password is compromised, a second verification step ensures only you can access your funds.';

  return (
    <div className="rounded-[8px] p-5 border-1 bg-accent-surface border-accent-6 bg-center flex flex-col md:flex-row gap-4 md:gap-5 items-start md:items-center justify-between">
      <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto">
        <LockClosedIcon
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
        <Button
          onClick={showMfaEnrollmentModal}
          className="w-full md:w-fit text-wrap justify-center"
        >
          Activate MFA
        </Button>
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
