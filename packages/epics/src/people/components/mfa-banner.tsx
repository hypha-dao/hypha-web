'use client';

import { ChromeBannerShell } from '../../common/chrome-banner';
import { Button } from '@hypha-platform/ui';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMFABanner } from '../hooks/useMFABanner';

export const MFABanner = () => {
  const tCommon = useTranslations('Common');
  const { onClose, isVisible, showMfaEnrollmentModal } = useMFABanner();

  if (!isVisible) return null;

  const title = 'Protect your funds';
  const subtitle =
    'Secure your wallet with Multi-Factor Authentication (MFA). Even if your password is compromised, a second verification step ensures only you can access your funds.';

  return (
    <ChromeBannerShell
      tone="accent"
      icon={<Shield strokeWidth={2} />}
      title={title}
      subtitle={subtitle}
      onDismiss={onClose}
      dismissLabel={tCommon('close')}
      actions={
        <Button
          size="sm"
          className="min-h-9 px-4"
          onClick={showMfaEnrollmentModal}
        >
          Activate MFA
        </Button>
      }
    />
  );
};
