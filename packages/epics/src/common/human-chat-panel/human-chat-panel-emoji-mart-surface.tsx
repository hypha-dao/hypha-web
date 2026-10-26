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
      data-testid="hypha-emoji-mart-surface"
      className={cn(
        /**
         * @emoji-mart/react mounts an empty wrapper `div` and appends
         * `em-emoji-picker` inside it. The host's own CSS is
         * `:host { width: min-content }`, which beats an un-`!important`
         * light-DOM width and then `dynamicWidth` measures ~130px.
         * Stretch the wrapper and force the host to the panel width.
         */
        'pointer-events-auto touch-manipulation flex h-[min(22.5rem,calc(100dvh-8rem))] w-full min-w-0 flex-col overflow-hidden [&>div]:h-full [&>div]:w-full [&>div]:min-w-0 [&_em-emoji-picker]:!h-full [&_em-emoji-picker]:!w-full [&_em-emoji-picker]:!max-w-none [&_em-emoji-picker]:!min-w-full',
        className,
      )}
      onWheel={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // emoji-mart search lives in shadow DOM. Retargeted keys look like
        // they hit the host, so Radix menu typeahead (e.g. "Copy") swallows
        // letters such as "c". Escape still closes the picker.
        if (event.key === 'Escape') return;
        event.stopPropagation();
      }}
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
