'use client';

import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

export function WalletFlowCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border border-border bg-background">
      <header className="px-4 pt-4">
        <h2
          className="text-4 leading-tight font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {title}
        </h2>
      </header>
      <div className="flex flex-col gap-4 px-4 pt-4 pb-4">{children}</div>
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

export function WalletAmountBlock({
  id,
  amount,
  onAmountChange,
  amountLabel,
  symbol,
  symbolNode,
  hint,
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
  presets?: number[];
  integer?: boolean;
}) {
  const numeric = Number(amount);
  return (
    <div className="border border-border px-4 py-5 text-center">
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
          onChange={(event) => {
            const next = integer
              ? event.target.value
              : event.target.value.replace(',', '.');
            const pattern = integer ? /^\d*$/ : /^\d*\.?\d*$/;
            if (next !== '' && !pattern.test(next)) return;
            onAmountChange(next);
          }}
          className="w-28 bg-transparent text-center outline-none"
        />
        {symbolNode ??
          (symbol ? (
            <span className="ml-2 align-middle text-2 tracking-[0.14em] uppercase">
              {symbol}
            </span>
          ) : null)}
      </div>
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
