'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelEmojiPickerProps = {
  children: React.ReactNode;
  /** Called when user selects an emoji (native string). */
  onEmojiSelect: (native: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible label for the picker surface (composer vs message react). */
  ariaLabel: string;
  align?: 'start' | 'center' | 'end';
  /** Additional class on trigger wrapper */
  className?: string;
};

export function HumanChatPanelEmojiPicker({
  children,
  onEmojiSelect,
  open,
  onOpenChange,
  ariaLabel,
  align = 'end',
  className,
}: HumanChatPanelEmojiPickerProps) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pickerLocale = ['en', 'es', 'fr', 'de', 'pt'].includes(locale)
    ? locale
    : 'en';

  /** emoji-mart v5 + shadow DOM: avoid `theme="auto"` inside Radix portal — wrong root can yield invisible UI. */
  const pickerTheme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild className={cn('inline-flex', className)}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto max-w-[min(100vw-2rem,352px)] border-border p-0 shadow-lg"
        aria-label={ariaLabel}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {mounted && (
          <div className="max-h-[min(420px,70vh)] w-[min(100vw-2rem,352px)] min-h-[230px] overflow-hidden">
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                onEmojiSelect(emoji.native);
                onOpenChange(false);
              }}
              theme={pickerTheme}
              previewPosition="none"
              skinTonePosition="search"
              locale={pickerLocale}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
