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

  const pickerLocale = ['en', 'es', 'fr', 'de', 'pt'].includes(locale)
    ? locale
    : 'en';

  const pickerTheme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className={cn(
        'max-h-[min(420px,70vh)] w-[min(100vw-2rem,352px)] min-h-[230px] overflow-hidden',
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
        />
      )}
    </div>
  );
}
