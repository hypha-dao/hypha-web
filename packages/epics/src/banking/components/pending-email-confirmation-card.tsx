'use client';

import { FC } from 'react';
import { MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import { BANKING_EMPTY_STATE_CLASS } from '../banking-ui';

export type PendingEmailConfirmationCardProps = {
  /**
   * Re-opens the setup form so the submitter can retype the email and resend (#2288, D3: rotates
   * the nonce). Omit for viewers who can't manage banking — resend requires filling in the form
   * again, so it's only offered to whoever `canManage` gates the rest of this tab for.
   */
  onResend?: () => void;
};

/**
 * Shown instead of the normal onboarding/status UI while a #2288 email-ownership confirmation is
 * pending — no Bridge KYC link exists yet, so there's nothing to show verification status for.
 * Shared between space and personal onboarding (D6) — no owner-specific copy needed here.
 */
export const PendingEmailConfirmationCard: FC<
  PendingEmailConfirmationCardProps
> = ({ onResend }) => {
  const t = useTranslations('BankingTab.pendingEmailConfirmation');

  return (
    <div className={BANKING_EMPTY_STATE_CLASS}>
      <MailCheck className="h-8 w-8 text-muted-foreground" />
      <p className="text-3 font-semibold text-foreground">{t('title')}</p>
      <p className="max-w-md text-2 text-muted-foreground">
        {t('description')}
      </p>
      {onResend ? (
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          onClick={onResend}
        >
          {t('resendCta')}
        </Button>
      ) : null}
    </div>
  );
};
