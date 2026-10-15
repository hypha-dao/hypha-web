'use client';

import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { CAPITALS, type CapitalKey } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import {
  spaceToolbarInputClassName,
  spaceToolbarInputRootClassName,
} from '../spaces/components/space-toolbar-styles';

/** Same eyebrow and title on every network section. */
export function NetworkSectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <header>
      <p className="mb-2 text-1 font-bold uppercase text-foreground">
        {eyebrow}
      </p>
      <h1
        className="text-7 leading-tight sm:text-8"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h1>
    </header>
  );
}

/** Same live search as the network list. Typing filters at once. There is no search button. */
export function NetworkLiveSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
      rootClassName={spaceToolbarInputRootClassName}
      className={spaceToolbarInputClassName}
    />
  );
}

/** The eleven forms of capital, in the same order and style on every network section. */
export function NetworkCapitalFilters({
  value,
  onChange,
  allLabel,
  labelFor,
}: {
  value: CapitalKey | 'all';
  onChange: (value: CapitalKey | 'all') => void;
  allLabel: string;
  labelFor: (key: CapitalKey) => string;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 sm:flex-nowrap sm:overflow-x-auto sm:pb-1"
      role="group"
      aria-label={allLabel}
    >
      <CapitalChip selected={value === 'all'} onClick={() => onChange('all')}>
        {allLabel}
      </CapitalChip>
      {CAPITALS.map((key) => (
        <CapitalChip
          key={key}
          selected={value === key}
          onClick={() => onChange(key)}
        >
          {labelFor(key)}
        </CapitalChip>
      ))}
    </div>
  );
}

function CapitalChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'shrink-0 border px-2.5 py-1 text-1',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-neutral-11',
      )}
    >
      {children}
    </button>
  );
}
