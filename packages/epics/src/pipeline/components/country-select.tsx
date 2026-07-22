'use client';

import React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { COUNTRY_GROUPS } from '@hypha-platform/core/client';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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

  const select = (code: string | null) => {
    if (disabled) return;
    onChange(code);
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <Popover
      modal={false}
      open={open && !disabled}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearchTerm('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          aria-expanded={open && !disabled}
          disabled={disabled}
          className={cn(
            'h-auto min-h-10 w-full justify-between py-2 font-normal',
            disabled && 'pointer-events-none opacity-50',
            className,
          )}
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.group}: ${selected.code}`
              : value
              ? value
              : placeholder}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-5 px-3 py-2">
          <Search className="size-4 shrink-0 text-neutral-10" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            disabled={disabled}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {allowNone ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2 hover:bg-accent-3"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(null)}
            >
              <span className="flex-1 truncate">{noneLabel}</span>
              <Check
                className={cn(
                  'ml-auto size-4',
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
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(option.code)}
                    >
                      <span className="flex-1 truncate">{option.code}</span>
                      <Check
                        className={cn(
                          'ml-auto size-4',
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
      </PopoverContent>
    </Popover>
  );
}
