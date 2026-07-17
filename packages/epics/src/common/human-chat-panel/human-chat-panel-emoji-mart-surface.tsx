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
      className={cn(
        /**
         * emoji-mart's `<em-emoji-picker>` defaults to `dynamicWidth: false`,
         * so its shadow-DOM grid computes its own fixed pixel width from
         * `perLine * emojiButtonSize` — it never reads *any* CSS width or
         * max-width we put on this wrapper. `dynamicWidth` below makes it
         * size itself from this element's actual rendered width instead, so
         * `w-full` here is load-bearing, not decorative — without it the
         * picker still ignores whatever space its container actually has
         * (e.g. inside a narrow Document PiP window).
         */
        'max-h-[min(420px,70vh)] w-full max-w-[min(100vw-2rem,352px)] min-h-[180px] overflow-hidden [&>em-emoji-picker]:w-full',
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
