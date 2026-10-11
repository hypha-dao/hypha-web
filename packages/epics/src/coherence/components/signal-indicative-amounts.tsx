'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';
import { Image } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTokens } from '../../treasury/hooks/use-tokens';

type Payout = { amount: string; token: string };

type SignalIndicativeAmountsProps = {
  payouts?: Payout[] | null;
  /** Load the saved amounts when they are not already on the signal in view. */
  slug?: string | null;
  className?: string;
};

const VISIBLE_CHIPS = 2;

/** 2400000 → 2.4M. Small amounts stay as typed numbers. */
export function compactIndicativeAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return trimmed;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const scaled = (divisor: number, suffix: string) => {
    const rounded = Math.round((abs / divisor) * 10) / 10;
    const text = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1);
    return `${sign}${text}${suffix}`;
  };
  if (abs >= 1_000_000_000) return scaled(1_000_000_000, 'B');
  if (abs >= 1_000_000) return scaled(1_000_000, 'M');
  if (abs >= 10_000) return scaled(1_000, 'K');
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  const small = Math.round(abs * 100) / 100;
  return `${sign}${small}`;
}

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
  const rows = (payouts ?? data?.indicativePayouts ?? []).filter(
    (payout) => payout.amount.trim() && payout.token.trim(),
  );

  const chips = React.useMemo(
    () =>
      rows.map((payout) => {
        const match = tokens.find(
          (token) => token.address.toLowerCase() === payout.token.toLowerCase(),
        );
        const symbol =
          match?.symbol ??
          (payout.token.length > 8
            ? `${payout.token.slice(0, 6)}…`
            : payout.token);
        const amount = compactIndicativeAmount(payout.amount);
        return {
          key: `${payout.token}-${payout.amount}`,
          amount,
          symbol,
          icon: match?.icon,
          title: `${t('indicativeTokens')}: ${payout.amount} ${symbol}`,
        };
      }),
    [rows, t, tokens],
  );

  if (chips.length === 0) return null;

  const visible = chips.slice(0, VISIBLE_CHIPS);
  const hidden = chips.length - visible.length;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 flex-wrap items-center gap-1',
        className,
      )}
    >
      {visible.map((chip) => (
        <span
          key={chip.key}
          title={chip.title}
          className="inline-flex max-w-[9.5rem] items-center gap-1 border border-border/80 bg-background px-1.5 py-0.5 text-[11px] leading-none text-foreground"
        >
          {chip.icon ? (
            <Image
              src={chip.icon}
              width={14}
              height={14}
              alt=""
              className="size-3.5 shrink-0 object-cover"
            />
          ) : null}
          <span className="shrink-0 tabular-nums">{chip.amount}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {chip.symbol}
          </span>
        </span>
      ))}
      {hidden > 0 ? (
        <span className="inline-flex items-center border border-border/80 bg-background px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}
