'use client';

import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false });

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
  const pickerLocale = ['en', 'es', 'fr', 'de', 'pt'].includes(locale)
    ? locale
    : 'en';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild className={cn('inline-flex', className)}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto border-border p-0 shadow-lg"
        aria-label={ariaLabel}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[min(420px,70vh)] w-[min(100vw-2rem,352px)] overflow-hidden">
          <Picker
            data={async () => (await import('@emoji-mart/data')).default}
            onEmojiSelect={(emoji: { native: string }) => {
              onEmojiSelect(emoji.native);
              onOpenChange(false);
            }}
            theme="auto"
            previewPosition="none"
            skinTonePosition="search"
            locale={pickerLocale}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
