'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';
import { cn } from '@hypha-platform/ui-utils';
import { useTokens } from '../../treasury/hooks/use-tokens';

type Payout = { amount: string; token: string };

type SignalIndicativeAmountsProps = {
  payouts?: Payout[] | null;
  /** Load the saved amounts when they are not already on the signal in view. */
  slug?: string | null;
  className?: string;
};

export function SignalIndicativeAmounts({
  payouts,
  slug,
  className,
}: SignalIndicativeAmountsProps) {
  const t = useTranslations('CoherenceTab');
  const params = useParams<{ id?: string }>();
  const spaceSlug = typeof params.id === 'string' ? params.id : '';
  const { tokens } = useTokens({ spaceSlug });
  const signalSlug = slug?.trim() ?? '';
  const shouldLoad = payouts == null && signalSlug.length > 0;
  const { data } = useSWR(
    shouldLoad ? ['signal-indicative-payouts', signalSlug] : null,
    async () => getCoherenceBySlug({ slug: signalSlug }),
  );
  const rows = payouts ?? data?.indicativePayouts ?? [];

  const label = React.useMemo(() => {
    if (rows.length === 0) return '';
    return rows
      .map((payout) => {
        const match = tokens.find(
          (token) => token.address.toLowerCase() === payout.token.toLowerCase(),
        );
        const symbol =
          match?.symbol ??
          (payout.token.length > 8
            ? `${payout.token.slice(0, 6)}…`
            : payout.token);
        return `${payout.amount} ${symbol}`;
      })
      .join(', ');
  }, [rows, tokens]);

  if (!label) return null;

  return (
    <p className={cn('text-1 text-muted-foreground', className)}>
      <span className="text-foreground">{t('indicativeTokens')}</span>
      {' · '}
      {label}
    </p>
  );
}
