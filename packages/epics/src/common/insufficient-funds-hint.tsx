'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

const linkClass =
  'cursor-pointer border-0 bg-transparent p-0 font-bold text-accent-9 underline';

/**
 * Shared insufficient-balance copy: buy USDC (Privy fund) and buy Hypha.
 * Used when a wallet action reverts for lack of funds.
 */
export function InsufficientFundsHint({
  onBuyUsdc,
  buyHyphaHref,
  className,
}: {
  onBuyUsdc: () => void;
  buyHyphaHref: string;
  className?: string;
}) {
  const t = useTranslations('AgreementFlow.insufficientFunds');

  return (
    <p className={cn('text-2 text-foreground', className)} role="alert">
      {t('lead')}{' '}
      <button type="button" onClick={onBuyUsdc} className={linkClass}>
        {t('buyUsdc')}
      </button>{' '}
      {t('or')}{' '}
      <Link href={buyHyphaHref} className={linkClass}>
        {t('buyHypha')}
      </Link>{' '}
      {t('trail')}
    </p>
  );
}

export function buyHyphaTokensHref(input: {
  lang: string;
  appearance?: 'default' | 'wallet';
  personSlug?: string | null;
}) {
  if (input.appearance === 'wallet' || !input.personSlug) {
    return `/${input.lang}/my-wallet/actions/purchase-hypha-tokens`;
  }
  return `/${input.lang}/profile/${input.personSlug}/actions/purchase-hypha-tokens`;
}
