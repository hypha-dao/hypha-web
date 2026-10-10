'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NetworkHorizon } from '@hypha-platform/core/client';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';

type MemberHomeHorizonProps = {
  horizon: NetworkHorizon;
  isSaving?: boolean;
  error?: string | null;
  onChoose: (horizon: NetworkHorizon) => void;
};

export function MemberHomeHorizon({
  horizon,
  isSaving,
  error,
  onChoose,
}: MemberHomeHorizonProps) {
  const t = useTranslations('MemberHome');
  const listening = horizon === 'network';
  const [explain, setExplain] = useState(false);
  const explanation = t('horizonNetworkBody');

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isSaving}
          aria-pressed={listening}
          onClick={() => onChoose(listening ? 'spaces' : 'network')}
          className="inline-flex items-center gap-2 text-left disabled:opacity-60"
        >
          <span
            aria-hidden
            className="relative shrink-0 border border-foreground"
            style={{
              width: 28,
              height: 16,
              background: listening ? 'var(--hypha-ink)' : 'var(--hypha-paper)',
            }}
          >
            <span
              className="absolute"
              style={{
                top: 2,
                width: 10,
                height: 10,
                left: listening ? 14 : 2,
                background: listening
                  ? 'var(--hypha-paper)'
                  : 'var(--hypha-ink)',
              }}
            />
          </span>
          <span className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
            {t('horizonNetwork')}
          </span>
        </button>
        <Popover open={explain} onOpenChange={setExplain}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-expanded={explain}
              aria-label={explanation}
              className="grid h-5 w-5 place-items-center border border-border bg-background text-1 leading-none text-neutral-11 hover:border-foreground hover:text-foreground"
            >
              ?
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(18rem,calc(100vw-2.5rem))] rounded-none border-border bg-background p-3 text-foreground shadow-sm"
          >
            <p className="text-2 leading-relaxed">{explanation}</p>
          </PopoverContent>
        </Popover>
      </div>
      {error ? (
        <p className="mt-1 text-1 text-error-11" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
