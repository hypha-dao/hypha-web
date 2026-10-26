'use client';

import { useEffect, useRef, useState } from 'react';
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
  /** Composer and hover-react sit at the bottom of the panel — open upward. */
  side?: 'top' | 'bottom' | 'left' | 'right';
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
  side = 'top',
  className,
  modal = true,
}: HumanChatPanelEmojiPickerProps) {
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const [boundary, setBoundary] = useState<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = triggerWrapRef.current?.closest(
      '[data-hypha-chat-panel], [data-testid="e2e-emoji-chat"], [data-sidebar="sidebar"]',
    );
    setBoundary(node ?? null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    // window capture runs before the Sheet's document capture listener.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onOpenChange]);

  return (
    <Popover modal={modal} open={open} onOpenChange={onOpenChange}>
      <div ref={triggerWrapRef} className={cn('inline-flex', className)}>
        <PopoverTrigger asChild className="inline-flex">
          {children}
        </PopoverTrigger>
      </div>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={12}
        collisionBoundary={boundary ?? undefined}
        container={boundary instanceof HTMLElement ? boundary : undefined}
        data-testid="hypha-emoji-picker-panel"
        className="pointer-events-auto z-[100] w-[min(22rem,var(--radix-popover-content-available-width),calc(100vw-2rem))] max-w-[min(22rem,var(--radix-popover-content-available-width),calc(100vw-2rem))] overflow-x-hidden overflow-hidden border-border p-0 shadow-lg"
        aria-label={ariaLabel}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(false);
        }}
        onPointerDownOutside={(event) => {
          const path = event.detail.originalEvent.composedPath();
          if (
            path.some(
              (node) =>
                node instanceof Element &&
                (node.tagName === 'EM-EMOJI-PICKER' ||
                  Boolean(node.closest?.('[data-hypha-emoji-picker]'))),
            )
          ) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const path = event.detail.originalEvent.composedPath();
          if (
            path.some(
              (node) =>
                node instanceof Element &&
                (node.tagName === 'EM-EMOJI-PICKER' ||
                  Boolean(node.closest?.('[data-hypha-emoji-picker]'))),
            )
          ) {
            event.preventDefault();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
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
