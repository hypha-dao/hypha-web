'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { cn } from '@hypha-platform/ui-utils';

import { getEmojiMartI18n } from './emoji-mart-i18n';

type HumanChatPanelEmojiMartSurfaceProps = {
  /** Accessible label for the picker surface. */
  ariaLabel: string;
  className?: string;
  onEmojiSelect: (native: string) => void;
};

/**
 * emoji-mart grid only (no Popover). Use inside PopoverContent, DropdownMenuSubContent, etc.
 */
export function HumanChatPanelEmojiMartSurface({
  ariaLabel,
  className,
  onEmojiSelect,
}: HumanChatPanelEmojiMartSurfaceProps) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const baseLocale = locale.toLowerCase().split(/[-_]/)[0] ?? 'en';
  const pickerLocale = ['en', 'es', 'fr', 'de', 'pt'].includes(baseLocale)
    ? baseLocale
    : 'en';

  const pickerTheme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      data-hypha-emoji-picker=""
      className={cn(
        /**
         * emoji-mart sizes its grid from this element's rendered width
         * (`dynamicWidth`). The parent popover/menu supplies a definite
         * width; `w-full` here fills it. A second min-width on this box
         * used to overflow the panel and clip the category row.
         */
        'flex h-[min(22.5rem,calc(100dvh-8rem))] w-full min-w-0 flex-col overflow-hidden [&>em-emoji-picker]:h-full [&>em-emoji-picker]:w-full [&>em-emoji-picker]:max-w-full',
        className,
      )}
    >
      {mounted && (
        <Picker
          data={data}
          i18n={getEmojiMartI18n(pickerLocale)}
          onEmojiSelect={(emoji: { native: string }) => {
            onEmojiSelect(emoji.native);
          }}
          theme={pickerTheme}
          previewPosition="none"
          skinTonePosition="search"
          locale={pickerLocale}
          dynamicWidth
        />
      )}
    </div>
  );
}
