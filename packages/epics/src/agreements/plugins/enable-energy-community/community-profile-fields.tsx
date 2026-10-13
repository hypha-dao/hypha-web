'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import {
  ENERGY_COMMUNITY_COUNTRIES,
  timeZoneForCountry,
} from '@hypha-platform/core/client';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const EnergyCommunityProfileFields = () => {
  const t = useTranslations('Energy.plugins.enableCommunity');
  const locale = useLocale();
  const { control, setValue } = useFormContext();
  const listId = 'energy-community-countries';
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const countries = useMemo(() => {
    const display = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
    return ENERGY_COMMUNITY_COUNTRIES.map((country) => ({
      ...country,
      label: display.of(country.iso) ?? country.name,
    })).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale]);

  const selectCountry = (iso: string) => {
    const zone = timeZoneForCountry(iso);
    if (zone) {
      setValue('energyCommunityProfile.timeZone', zone, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    setOpen(false);
    setQuery('');
    return iso;
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <FormField
        control={control}
        name="energyCommunityProfile.countryIso"
        render={({ field }) => {
          const selected = countries.find(
            (country) => country.iso === field.value,
          );
          const needle = fold(query.trim());
          const matches = needle
            ? countries.filter((country) =>
                fold(
                  `${country.label} ${country.name} ${country.iso}`,
                ).includes(needle),
              )
            : countries;
          const inputValue = open ? query : selected?.label ?? '';

          const choose = (iso: string) => {
            field.onChange(selectCountry(iso));
          };

          return (
            <FormItem>
              <FormLabel>{t('country')}</FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                  <div ref={anchorRef} className="w-full">
                    <FormControl>
                      <Input
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        autoComplete="off"
                        placeholder={t('selectCountry')}
                        value={inputValue}
                        onFocus={(event) => {
                          setQuery(selected?.label ?? '');
                          setActiveIndex(0);
                          setOpen(true);
                          event.currentTarget.select();
                        }}
                        onBlur={() => {
                          const typed = fold(query.trim());
                          const exact = countries.filter(
                            (country) =>
                              fold(country.label) === typed ||
                              fold(country.name) === typed,
                          );
                          const exactMatch = exact[0];
                          if (exact.length === 1 && exactMatch) {
                            choose(exactMatch.iso);
                          } else {
                            setOpen(false);
                          }
                        }}
                        onChange={(event) => {
                          const next = event.target.value;
                          setQuery(next);
                          setActiveIndex(0);
                          setOpen(true);
                          if (
                            !selected ||
                            fold(next) !== fold(selected.label)
                          ) {
                            field.onChange('');
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setOpen(true);
                            const next = Math.min(
                              activeIndex + 1,
                              matches.length - 1,
                            );
                            setActiveIndex(next);
                            document
                              .getElementById(`${listId}-${matches[next]?.iso}`)
                              ?.scrollIntoView({ block: 'nearest' });
                          } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            const next = Math.max(activeIndex - 1, 0);
                            setActiveIndex(next);
                            document
                              .getElementById(`${listId}-${matches[next]?.iso}`)
                              ?.scrollIntoView({ block: 'nearest' });
                          } else if (event.key === 'Enter' && open) {
                            event.preventDefault();
                            const match = matches[activeIndex];
                            if (match) choose(match.iso);
                          } else if (event.key === 'Escape') {
                            setOpen(false);
                            setQuery('');
                          }
                        }}
                      />
                    </FormControl>
                  </div>
                </PopoverAnchor>
                <PopoverContent
                  align="start"
                  className="z-[100] p-0"
                  style={{ width: anchorRef.current?.offsetWidth }}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <ul
                    id={listId}
                    role="listbox"
                    className="max-h-60 overflow-y-auto py-1"
                  >
                    {matches.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        {t('noCountryFound')}
                      </li>
                    ) : (
                      matches.map((country, index) => (
                        <li key={country.iso} role="presentation">
                          <button
                            type="button"
                            id={`${listId}-${country.iso}`}
                            role="option"
                            aria-selected={country.iso === field.value}
                            className={cn(
                              'flex w-full cursor-pointer px-3 py-2 text-left text-sm',
                              index === activeIndex && 'bg-accent-3',
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              choose(country.iso);
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                          >
                            {country.label}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
};
