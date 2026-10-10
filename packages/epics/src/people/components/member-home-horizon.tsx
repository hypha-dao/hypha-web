'use client';

import { useTranslations } from 'next-intl';
import type { NetworkHorizon } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

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

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={isSaving}
        aria-pressed={listening}
        aria-describedby="member-home-horizon-hint"
        onClick={() => onChoose(listening ? 'spaces' : 'network')}
        className="inline-flex items-center gap-2 text-left disabled:opacity-60"
      >
        <span
          aria-hidden
          className={cn(
            'relative h-4 w-7 shrink-0 border',
            listening
              ? 'border-foreground bg-foreground'
              : 'border-border bg-background',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-2.5',
              listening ? 'right-0.5 bg-background' : 'left-0.5 bg-foreground',
            )}
          />
        </span>
        <span className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
          {t('horizonNetwork')}
        </span>
      </button>
      <p id="member-home-horizon-hint" className="sr-only">
        {t('horizonNetworkBody')}
      </p>
      {error ? (
        <p className="mt-1 text-1 text-error-11" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
