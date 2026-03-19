'use client';

import { Globe } from 'lucide-react';
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
          size="default"
          aria-label={ariaLabel}
          className="gap-1.5"
        >
          <Globe className="size-4" />
          <span className="sr-only">{currentMeta?.label ?? currentLocale}</span>
          <span className="text-xs font-semibold" aria-hidden>
            {currentMeta?.shortLabel ?? currentLocale.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        {locales
          .filter((locale) => locale.code !== currentLocale)
          .map((locale) => (
            <DropdownMenuItem
              key={locale.code}
              onClick={() => onLocaleChange(locale.code)}
            >
              {locale.label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
