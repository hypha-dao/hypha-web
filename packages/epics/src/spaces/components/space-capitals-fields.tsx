'use client';

import { useTranslations } from 'next-intl';
import { CAPITALS, type CapitalKey } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

export type SpaceCapitalSelection = {
  seeks: CapitalKey[];
  offers: CapitalKey[];
};

function toggle(list: CapitalKey[], key: CapitalKey): CapitalKey[] {
  return list.includes(key)
    ? list.filter((item) => item !== key)
    : [...list, key];
}

function CapitalChips({
  selected,
  disabled,
  onToggle,
}: {
  selected: CapitalKey[];
  disabled?: boolean;
  onToggle: (key: CapitalKey) => void;
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
            onClick={() => onToggle(key)}
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

/** Several forms of capital. A space can seek more than one, and offer more than one back. */
export function SpaceCapitalsFields({
  seeks,
  offers,
  disabled,
  onChange,
}: SpaceCapitalSelection & {
  disabled?: boolean;
  onChange: (next: SpaceCapitalSelection) => void;
}) {
  const t = useTranslations('NetworkExchange');
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('seeks')}
        </p>
        <div className="mt-2">
          <CapitalChips
            selected={seeks}
            disabled={disabled}
            onToggle={(key) => onChange({ seeks: toggle(seeks, key), offers })}
          />
        </div>
      </div>
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('offers')}
        </p>
        <div className="mt-2">
          <CapitalChips
            selected={offers}
            disabled={disabled}
            onToggle={(key) => onChange({ seeks, offers: toggle(offers, key) })}
          />
        </div>
      </div>
    </div>
  );
}
