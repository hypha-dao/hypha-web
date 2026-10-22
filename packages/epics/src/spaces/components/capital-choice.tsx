'use client';

import { useTranslations } from 'next-intl';
import { CAPITALS, type CapitalKey } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

/** Shared chips for the eleven forms of capital. `many` toggles. `one` keeps a single choice. */
export function CapitalChoice({
  mode,
  selected,
  disabled,
  onChange,
}: {
  mode: 'many' | 'one';
  selected: readonly CapitalKey[];
  disabled?: boolean;
  onChange: (next: CapitalKey[]) => void;
}) {
  const t = useTranslations('NetworkExchange');
  return (
    <div className="flex flex-wrap gap-1">
      {CAPITALS.map((key) => {
        const on = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              if (mode === 'one') {
                onChange(on ? [] : [key]);
                return;
              }
              const next = on
                ? selected.filter((item) => item !== key)
                : [...selected, key];
              onChange(CAPITALS.filter((item) => next.includes(item)));
            }}
            className={cn(
              'border px-2 py-1 text-1 disabled:opacity-40',
              on
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11',
            )}
          >
            {t(`capitals.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
