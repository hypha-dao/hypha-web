'use client';

import { Check, Globe } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import { Button } from './button';
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

export function LanguageSelect({
  currentLocale,
  locales,
  onLocaleChange,
  ariaLabel = 'Select language',
}: LanguageSelectProps) {
  const currentMeta = locales.find((l) => l.code === currentLocale);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          size="default"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          data-language-select-trigger
          className="h-10 min-h-10 gap-1.5 px-3 py-0"
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
              <span className="min-w-0 flex-1 truncate text-left font-medium">
                {locale.label}
                <span className="ml-1.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
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
