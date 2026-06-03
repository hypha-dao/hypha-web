'use client';

import { SmilePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { HumanChatPanelEmojiMartSurface } from './human-chat-panel-emoji-mart-surface';
import { CALL_QUICK_REACTIONS } from './call-quick-reactions';

type HumanChatPanelCallReactPopoverProps = {
  disabled?: boolean;
  localHandRaised: boolean;
  onSendReaction: (emoji: string) => void;
  onToggleRaiseHand: () => void;
  variant?: 'inBanner' | 'fullView';
  density?: 'default' | 'compact' | 'pip';
};

/** WCUX-REACT-4 — quick reactions, emoji picker, and raise-hand toggle. */
export function HumanChatPanelCallReactPopover({
  disabled = false,
  localHandRaised,
  onSendReaction,
  onToggleRaiseHand,
  variant = 'inBanner',
  density = 'default',
}: HumanChatPanelCallReactPopoverProps) {
  const t = useTranslations('HumanChatPanel');
  const isFull = variant === 'fullView';
  const isPip = density === 'pip';

  const triggerClassName = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    isFull
      ? 'h-10 min-w-10 border-zinc-600/80 bg-zinc-900/90 text-white hover:bg-zinc-800/95'
      : isPip
      ? 'h-5 w-5 border-border/60 bg-background/95 text-foreground'
      : 'h-8 w-8 border-border/60 bg-background text-foreground hover:bg-muted',
    localHandRaised &&
      !isFull &&
      'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={triggerClassName}
          title={t('callReactButton')}
          aria-label={t('callReactButtonAria')}
        >
          <SmilePlus
            className={cn(
              isFull ? 'h-5 w-5' : isPip ? 'h-2.5 w-2.5' : 'h-4 w-4',
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="z-[140] w-[min(100vw-2rem,320px)] space-y-3 border-border p-3 shadow-xl"
      >
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">
            {t('callReactQuickReactions')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CALL_QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={disabled}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background text-xl hover:bg-muted disabled:opacity-50"
                aria-label={t('callReactSendEmoji', { emoji })}
                onClick={() => {
                  void onSendReaction(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <HumanChatPanelEmojiMartSurface
          ariaLabel={t('callReactMoreEmoji')}
          className="max-h-[min(320px,50vh)]"
          onEmojiSelect={(emoji) => {
            void onSendReaction(emoji);
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground">
            {t('callRaiseHandDescription')}
          </p>
          <Button
            type="button"
            size="sm"
            variant={localHandRaised ? 'default' : 'outline'}
            disabled={disabled}
            className="shrink-0"
            onClick={() => {
              void onToggleRaiseHand();
            }}
          >
            {localHandRaised ? t('callLowerHand') : t('callRaiseHand')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
