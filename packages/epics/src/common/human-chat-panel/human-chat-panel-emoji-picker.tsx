'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { HumanChatPanelEmojiMartBody } from './human-chat-panel-emoji-mart-body';

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
        <HumanChatPanelEmojiMartBody
          onEmojiSelect={(native) => {
            onEmojiSelect(native);
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
