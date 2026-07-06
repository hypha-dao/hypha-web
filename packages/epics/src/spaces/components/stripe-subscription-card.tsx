'use client';

import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';

import { Button } from '@hypha-platform/ui';

import { useStripeSubscription } from '../hooks/use-stripe-subscription';

type StripeSubscriptionCardProps = {
  spaceSlug: string;
  lang: string;
};

/**
 * Shows the caller's card subscription for this space (if any) with a
 * link to the Stripe Customer Portal. Hidden when the feature flag is off
 * or the caller has no Stripe subscription for this space.
 */
export const StripeSubscriptionCard = ({
  spaceSlug,
  lang,
}: StripeSubscriptionCardProps) => {
  const t = useTranslations('StripeSubscription');
  const { enabled, subscription, isRedirecting, error, openBillingPortal } =
    useStripeSubscription({ spaceSlug, lang });

  if (!enabled || !subscription?.mySubscription) {
    return null;
  }

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    past_due: t('statusPastDue'),
    canceled: t('statusCanceled'),
    incomplete: t('statusIncomplete'),
  };
  const status = subscription.mySubscription.status;

  return (
    <div className="bg-accent-surface-mix rounded-[8px] border-1 border-accent-6 p-5 flex flex-col lg:flex-row gap-4 lg:gap-5 items-start lg:items-center justify-between">
      <div className="flex items-center gap-3 lg:gap-5">
        <CreditCard className="size-[22px] shrink-0" strokeWidth={1.75} />
        <div className="flex flex-col gap-1">
          <span className="text-2 text-foreground font-bold">{t('title')}</span>
          <span className="text-2 text-foreground">
            {t('statusLabel', { status: statusLabels[status] ?? status })}
          </span>
          {error ? <span className="text-1 text-error-11">{error}</span> : null}
        </div>
      </div>
      <Button
        onClick={openBillingPortal}
        disabled={isRedirecting}
        className="w-full lg:w-fit justify-center"
      >
        {t('manageBilling')}
      </Button>
    </div>
  );
};
