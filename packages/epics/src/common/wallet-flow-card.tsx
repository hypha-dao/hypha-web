'use client';

import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

export function WalletFlowCard({
  title,
  children,
  framed = true,
}: {
  title: string;
  children: ReactNode;
  /** Border on a rail or overlay. Wallet pages sit on the screen, so they omit it. */
  framed?: boolean;
}) {
  return (
    <section
      className={cn('min-w-0', framed && 'border border-border bg-background')}
    >
      {framed ? (
        <header className="px-4 pt-4">
          <h2
            className="text-4 leading-tight font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {title}
          </h2>
        </header>
      ) : null}
      <div
        className={cn(
          'flex flex-col gap-4',
          framed ? 'px-4 pt-4 pb-4' : undefined,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function WalletFlowLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
      {children}
    </p>
  );
}

export function walletPresetClass(active: boolean) {
  return cn(
    'h-10 min-w-10 border px-3 text-2 tabular-nums',
    active
      ? 'border-foreground bg-foreground text-background'
      : 'border-border hover:bg-accent-2',
  );
}

export function formatWalletAmount(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

/** What the member holds, set against the amount this action would move. */
export function WalletHoldingLine({
  label,
  amount,
  symbol,
  enough = true,
}: {
  label: string;
  amount: string;
  symbol: string;
  enough?: boolean;
}) {
  return (
    <p
      className={cn(
        'mt-3 flex items-baseline justify-center gap-2 text-1',
        enough ? 'text-neutral-11' : 'text-error-11',
      )}
    >
      <span className="tracking-[0.16em] uppercase">{label}</span>
      <span
        className={cn(
          'text-2 tabular-nums',
          enough ? 'text-foreground' : 'text-error-11',
        )}
      >
        {amount}
      </span>
      <span className="tracking-[0.14em] uppercase">{symbol}</span>
    </p>
  );
}

export function WalletAmountBlock({
  id,
  amount,
  onAmountChange,
  amountLabel,
  symbol,
  symbolNode,
  hint,
  holding,
  presets,
  integer = false,
}: {
  id: string;
  amount: string;
  onAmountChange: (value: string) => void;
  amountLabel: string;
  symbol?: string;
  symbolNode?: ReactNode;
  hint?: ReactNode;
  holding?: {
    label: string;
    amount: string;
    symbol: string;
    enough?: boolean;
  };
  presets?: number[];
  integer?: boolean;
}) {
  const numeric = Number(amount);
  const enough = holding?.enough !== false;
  return (
    <div
      className={cn(
        'border px-4 py-5 text-center',
        enough ? 'border-border' : 'border-error-7',
      )}
    >
      <div
        className="text-8 leading-none tabular-nums tracking-[-0.04em]"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        <label className="sr-only" htmlFor={id}>
          {amountLabel}
        </label>
        <input
          id={id}
          inputMode={integer ? 'numeric' : 'decimal'}
          value={amount}
          placeholder="0"
          onChange={(event) => {
            const next = integer
              ? event.target.value
              : event.target.value.replace(',', '.');
            const pattern = integer ? /^\d*$/ : /^\d*\.?\d*$/;
            if (next !== '' && !pattern.test(next)) return;
            onAmountChange(next);
          }}
          className="w-40 min-w-[5rem] border border-foreground bg-background px-3 py-2 text-center text-foreground outline-none placeholder:text-neutral-9 focus:bg-neutral-2"
        />
        {symbolNode ??
          (symbol ? (
            <span className="ml-2 align-middle text-2 tracking-[0.14em] uppercase">
              {symbol}
            </span>
          ) : null)}
      </div>
      {holding ? (
        <WalletHoldingLine
          label={holding.label}
          amount={holding.amount}
          symbol={holding.symbol}
          enough={holding.enough}
        />
      ) : null}
      {hint ? <div className="mt-2 text-1 text-neutral-11">{hint}</div> : null}
      {presets && presets.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {presets.map((value) => (
            <button
              key={value}
              type="button"
              className={walletPresetClass(Math.abs(numeric - value) < 1e-9)}
              onClick={() => onAmountChange(String(value))}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
