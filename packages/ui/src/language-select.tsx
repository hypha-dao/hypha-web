'use client';

import { Check, Globe } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /** Optional heading shown above the locale list (e.g. translated "Interface language"). */
  menuHeading?: string;
};

export function LanguageSelect({
  currentLocale,
  locales,
  onLocaleChange,
  ariaLabel = 'Select language',
  menuHeading,
}: LanguageSelectProps) {
  const currentMeta = locales.find((l) => l.code === currentLocale);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          size="sm"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          data-language-select-trigger
          className="min-w-9 gap-1.5 px-3"
        >
          <Globe className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">{currentMeta?.label ?? currentLocale}</span>
          <span className="text-xs font-semibold tabular-nums" aria-hidden>
            {currentMeta?.shortLabel ?? currentLocale.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'w-[var(--radix-dropdown-menu-trigger-width)] min-w-[11.5rem] border border-border/90',
          'bg-popover p-1 text-popover-foreground shadow-xl',
        )}
      >
        {menuHeading ? (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-1 font-medium leading-tight text-muted-foreground">
              {menuHeading}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="-mx-1 my-0.5" />
          </>
        ) : null}
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
                'min-h-9 gap-2 px-2 py-2 text-2',
                active &&
                  'cursor-default bg-neutral-3/90 text-foreground focus:bg-neutral-3/90 focus:text-foreground data-[highlighted]:bg-neutral-3/90',
              )}
              aria-current={active ? 'true' : undefined}
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center text-accent-11"
                aria-hidden
              >
                {active ? <Check className="size-4" strokeWidth={2.5} /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="truncate font-medium leading-snug">
                  {locale.label}
                </span>
                <span className="text-1 font-mono font-semibold uppercase tracking-wide text-muted-foreground">
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
