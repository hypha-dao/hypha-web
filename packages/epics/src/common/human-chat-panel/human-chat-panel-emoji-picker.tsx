'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { HumanChatPanelEmojiMartSurface } from './human-chat-panel-emoji-mart-surface';

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
  /**
   * When false, outside clicks reach other controls (e.g. switching from attach
   * menu to emoji in one click). Defaults to true for message reaction pickers.
   */
  modal?: boolean;
};

export function HumanChatPanelEmojiPicker({
  children,
  onEmojiSelect,
  open,
  onOpenChange,
  ariaLabel,
  align = 'end',
  className,
  modal = true,
}: HumanChatPanelEmojiPickerProps) {
  return (
    <Popover modal={modal} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild className={cn('inline-flex', className)}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto max-w-[min(100vw-2rem,352px)] border-border p-0 shadow-lg"
        aria-label={ariaLabel}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <HumanChatPanelEmojiMartSurface
          ariaLabel={ariaLabel}
          onEmojiSelect={(native) => {
            onEmojiSelect(native);
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
