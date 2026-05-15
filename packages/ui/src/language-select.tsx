'use client';

import { Check, Globe } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

type LocaleOption = {
  code: string;
  label: string;
  shortLabel: string;
};

type LanguageSelectProps = {
  currentLocale: string;
  locales: LocaleOption[];
  onLocaleChange: (locale: string) => void;
  ariaLabel?: string;
};

/** Toolbar trigger: matches profile avatar button (rounded-md, neutral border, h-10, no ring hover blur). */
const languageTriggerClassName = cn(
  'box-border flex h-10 min-h-10 shrink-0 cursor-pointer items-center gap-1.5 px-3',
  'isolate overflow-hidden rounded-md bg-neutral-1 text-neutral-12 outline-none',
  'text-xs font-semibold shadow-sm transition-colors duration-150',
  'hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'data-[state=open]:shadow-md',
);

export function LanguageSelect({
  currentLocale,
  locales,
  onLocaleChange,
  ariaLabel = 'Select language',
}: LanguageSelectProps) {
  const currentMeta = locales.find((l) => l.code === currentLocale);

  return (
    <DropdownMenu modal={true}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          data-language-select-trigger
          className={languageTriggerClassName}
        >
          <Globe className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">{currentMeta?.label ?? currentLocale}</span>
          <span className="tabular-nums" aria-hidden>
            {currentMeta?.shortLabel ?? currentLocale.toUpperCase()}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-[120]',
          'w-[var(--radix-dropdown-menu-trigger-width)] min-w-[10.5rem] border border-border/90',
          'bg-popover px-1 py-1 text-popover-foreground shadow-xl',
        )}
      >
        {locales.map((locale) => {
          const active = locale.code === currentLocale;
          return (
            <DropdownMenuItem
              key={locale.code}
              textValue={`${locale.label} ${locale.shortLabel}`}
              onSelect={(event) => {
                if (active) {
                  event.preventDefault();
                  return;
                }
                onLocaleChange(locale.code);
              }}
              className={cn(
                'min-h-0 gap-2 rounded-md px-2 py-1.5 text-2 leading-tight',
                active &&
                  'cursor-default bg-neutral-3/90 text-foreground focus:bg-neutral-3/90 focus:text-foreground data-[highlighted]:bg-neutral-3/90',
              )}
              aria-current={active ? 'true' : undefined}
            >
              <span
                className="flex size-4 shrink-0 items-center justify-center text-accent-11"
                aria-hidden
              >
                {active ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-2 font-normal">
                {locale.label}
                <span className="ml-1.5 text-2 font-normal text-muted-foreground">
                  {locale.shortLabel}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
