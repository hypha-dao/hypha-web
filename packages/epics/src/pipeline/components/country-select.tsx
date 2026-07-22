'use client';

import React from 'react';
import { Check, Search } from 'lucide-react';
import { ChevronDownIcon } from '@radix-ui/themes';
import { COUNTRY_GROUPS } from '@hypha-platform/core/client';
import {
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

/** Match `@hypha-platform/ui` SelectTrigger sizing/look. */
const TRIGGER_CLASS =
  'h-6 flex w-full items-center justify-between rounded border border-input bg-neutral-1 px-3 py-2 text-2 font-normal ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

type CountryOption = {
  code: string;
  group: string;
  searchText: string;
};

type CountrySelectProps = {
  value: string | null;
  onChange: (code: string | null) => void;
  countryFocus?: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyListMessage?: string;
  noneLabel?: string;
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
  /** Use true outside dialogs; false inside modal dialogs. */
  popoverModal?: boolean;
};

export function CountrySelect({
  value,
  onChange,
  countryFocus,
  placeholder = 'Select country',
  searchPlaceholder = 'Search countries…',
  emptyListMessage = 'No countries found.',
  noneLabel = 'No country',
  allowNone = true,
  disabled = false,
  className,
  popoverModal = true,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const options = React.useMemo(() => {
    const allow = new Set(
      (countryFocus ?? []).map((c) => c.toUpperCase()).filter(Boolean),
    );
    const rows: CountryOption[] = [];
    for (const [group, codes] of Object.entries(COUNTRY_GROUPS)) {
      const filtered = allow.size
        ? codes.filter((code) => allow.has(code))
        : codes;
      for (const code of filtered) {
        rows.push({
          code,
          group,
          searchText: `${group} ${code}`.toLowerCase(),
        });
      }
    }
    return rows;
  }, [countryFocus]);

  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => option.searchText.includes(term));
  }, [options, searchTerm]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CountryOption[]>();
    for (const option of filtered) {
      const list = map.get(option.group) ?? [];
      list.push(option);
      map.set(option.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const selected = options.find((option) => option.code === value) ?? null;

  const select = React.useCallback(
    (code: string | null) => {
      if (disabled) return;
      onChange(code);
      setOpen(false);
      setSearchTerm('');
    },
    [disabled, onChange],
  );

  const onOptionPointerDown = (
    event: React.PointerEvent,
    code: string | null,
  ) => {
    // Commit on pointerdown so Dialog/DismissableLayer cannot swallow the click.
    event.preventDefault();
    event.stopPropagation();
    select(code);
  };

  return (
    <Popover
      modal={popoverModal}
      open={open && !disabled}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearchTerm('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open && !disabled}
          disabled={disabled}
          className={cn(TRIGGER_CLASS, className)}
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.group}: ${selected.code}`
              : value
              ? value
              : placeholder}
          </span>
          <span className="w-2 shrink-0">
            <ChevronDownIcon className="size-2" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          // Keep open when interacting with nested portaled UI; otherwise default close.
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-pipeline-select-content="true"]')) {
            event.preventDefault();
          }
        }}
      >
        <div
          data-pipeline-select-content="true"
          className="flex flex-col"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-neutral-5 px-2 py-1.5">
            <Search className="size-3.5 shrink-0 text-neutral-10" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-6 border-0 bg-transparent px-0 text-2 shadow-none focus-visible:ring-0"
              disabled={disabled}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {allowNone ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2 hover:bg-accent-3"
                onPointerDown={(event) => onOptionPointerDown(event, null)}
              >
                <span className="flex-1 truncate">{noneLabel}</span>
                <Check
                  className={cn(
                    'ml-auto size-3.5',
                    !value ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            ) : null}

            {grouped.length === 0 ? (
              <p className="px-2 py-3 text-2 text-neutral-11">
                {emptyListMessage}
              </p>
            ) : (
              grouped.map(([group, codes]) => (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1 text-1 font-medium uppercase tracking-wide text-neutral-10">
                    {group}
                  </div>
                  {codes.map((option) => {
                    const isSelected = value === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2 hover:bg-accent-3',
                          isSelected && 'bg-accent-3/60',
                        )}
                        onPointerDown={(event) =>
                          onOptionPointerDown(event, option.code)
                        }
                      >
                        <span className="flex-1 truncate">{option.code}</span>
                        <Check
                          className={cn(
                            'ml-auto size-3.5',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
