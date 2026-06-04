'use client';

import { useState } from 'react';
import {
  ChevronUp,
  CircleHelp,
  Ellipsis,
  Heart,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { HumanChatPanelEmojiMartSurface } from './human-chat-panel-emoji-mart-surface';
import {
  CALL_BE_RIGHT_BACK_EMOJI,
  CALL_FEEDBACK_REACTIONS,
  CALL_SEND_WITH_EFFECT_EMOJIS,
  CALL_STANDARD_REACTION_EMOJIS,
  type CallFeedbackReactionId,
  type CallFloatingReactionStyle,
} from './call-zoom-reaction-catalog';

type HumanChatPanelCallReactPopoverProps = {
  disabled?: boolean;
  localHandRaised: boolean;
  onSendReaction: (emoji: string, style?: CallFloatingReactionStyle) => void;
  onToggleRaiseHand: () => void;
  variant?: 'inBanner' | 'fullView';
  density?: 'default' | 'compact' | 'pip';
};

type EmojiPickerPanel = null | 'effects' | 'reactions';

function ReactionEmojiButton({
  emoji,
  disabled,
  label,
  onPick,
  className,
}: {
  emoji: string;
  disabled: boolean;
  label: string;
  onPick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 text-xl transition-colors hover:bg-zinc-700 disabled:opacity-50',
        className,
      )}
      onClick={onPick}
    >
      {emoji}
    </button>
  );
}

function MoreEmojiButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
      onClick={onClick}
    >
      <Ellipsis className="h-4 w-4" aria-hidden />
    </button>
  );
}

function FeedbackReactionButton({
  id,
  disabled,
  label,
  onPick,
}: {
  id: CallFeedbackReactionId;
  disabled: boolean;
  label: string;
  onPick: () => void;
}) {
  const base =
    'inline-flex h-11 flex-1 min-w-0 items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50';
  const styles: Record<CallFeedbackReactionId, string> = {
    yes: 'border-emerald-600/40 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/80',
    no: 'border-rose-600/40 bg-rose-950/80 text-rose-400 hover:bg-rose-900/80',
    slower:
      'border-zinc-600/50 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90',
    faster:
      'border-sky-600/40 bg-sky-950/80 text-sky-300 hover:bg-sky-900/80',
    away: 'border-zinc-600/50 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90',
  };
  const icons: Record<CallFeedbackReactionId, string> = {
    yes: '✓',
    no: '✕',
    slower: '«',
    faster: '»',
    away: '☕',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(base, styles[id])}
      onClick={onPick}
    >
      <span aria-hidden>{icons[id]}</span>
    </button>
  );
}

/** Zoom-style React menu — effects, reactions, feedback, raise hand, be right back. */
export function HumanChatPanelCallReactPopover({
  disabled = false,
  localHandRaised,
  onSendReaction,
  onToggleRaiseHand,
  variant = 'inBanner',
  density = 'default',
}: HumanChatPanelCallReactPopoverProps) {
  const t = useTranslations('HumanChatPanel');
  const [open, setOpen] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState<EmojiPickerPanel>(null);
  const isFull = variant === 'fullView';
  const isPip = density === 'pip';
  const showReactLabel = !isPip;

  const handleSend = (emoji: string, style: CallFloatingReactionStyle = 'default') => {
    onSendReaction(emoji, style);
    setOpen(false);
    setEmojiPicker(null);
  };

  const popoverSurface = isFull
    ? 'border-zinc-700 bg-zinc-950 text-zinc-100'
    : 'border-border bg-popover text-popover-foreground';

  const sectionTitle = isFull
    ? 'text-sm font-semibold text-zinc-100'
    : 'text-sm font-semibold text-foreground';

  const actionRowBtn = cn(
    'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
    isFull
      ? 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700/90'
      : 'bg-muted/80 text-foreground hover:bg-muted',
  );

  const triggerClassName = cn(
    'inline-flex shrink-0 items-center justify-center gap-1 rounded-full border shadow-sm transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    isFull
      ? 'h-10 min-h-10 border-zinc-600/80 bg-zinc-900/90 px-3 text-white hover:bg-zinc-800/95'
      : isPip
      ? 'h-5 w-5 border-border/60 bg-background/95 px-0 text-foreground'
      : 'h-8 border-border/60 bg-background px-2.5 text-foreground hover:bg-muted',
    open &&
      !isFull &&
      'border-primary/40 bg-muted',
    localHandRaised &&
      !isFull &&
      !open &&
      'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setEmojiPicker(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid="call-react-trigger"
          className={triggerClassName}
          title={t('callReactButton')}
          aria-label={t('callReactButtonAria')}
        >
          <Heart
            className={cn(
              isFull ? 'h-4 w-4' : isPip ? 'h-2.5 w-2.5' : 'h-4 w-4',
              open && 'fill-current',
            )}
            aria-hidden
          />
          {showReactLabel ? (
            <span className="text-sm font-medium">{t('callReactButton')}</span>
          ) : null}
          {showReactLabel ? (
            <ChevronUp
              className={cn(
                'h-3.5 w-3.5 opacity-70 transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        data-testid="call-react-popover-content"
        className={cn(
          'z-[140] w-[min(100vw-2rem,360px)] space-y-4 p-3 shadow-xl',
          popoverSurface,
        )}
      >
        {emojiPicker ? (
          <div className="space-y-2">
            <button
              type="button"
              className={cn(
                'text-xs font-medium underline-offset-2 hover:underline',
                isFull ? 'text-zinc-400' : 'text-muted-foreground',
              )}
              onClick={() => setEmojiPicker(null)}
            >
              {t('callReactBackToMenu')}
            </button>
            <HumanChatPanelEmojiMartSurface
              ariaLabel={t('callReactMoreEmoji')}
              className="max-h-[min(320px,50vh)]"
              onEmojiSelect={(emoji) => {
                handleSend(
                  emoji,
                  emojiPicker === 'effects' ? 'effect' : 'default',
                );
              }}
            />
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center gap-1.5">
                <h3 className={sectionTitle}>{t('callReactSendWithEffect')}</h3>
                <span
                  className="inline-flex text-zinc-500"
                  title={t('callReactSendWithEffectHint')}
                >
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">
                    {t('callReactSendWithEffectHint')}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {CALL_SEND_WITH_EFFECT_EMOJIS.map((emoji) => (
                  <ReactionEmojiButton
                    key={`effect-${emoji}`}
                    emoji={emoji}
                    disabled={disabled}
                    label={t('callReactSendEmoji', { emoji })}
                    onPick={() => handleSend(emoji, 'effect')}
                  />
                ))}
                <MoreEmojiButton
                  disabled={disabled}
                  label={t('callReactMore')}
                  onClick={() => setEmojiPicker('effects')}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className={sectionTitle}>{t('callReactReactionsSection')}</h3>
              <div className="flex flex-wrap items-center gap-2">
                {CALL_STANDARD_REACTION_EMOJIS.map((emoji) => (
                  <ReactionEmojiButton
                    key={`reaction-${emoji}`}
                    emoji={emoji}
                    disabled={disabled}
                    label={t('callReactSendEmoji', { emoji })}
                    onPick={() => handleSend(emoji, 'default')}
                    className="h-11 w-11 text-2xl bg-transparent hover:bg-zinc-800/60"
                  />
                ))}
                <MoreEmojiButton
                  disabled={disabled}
                  label={t('callReactMore')}
                  onClick={() => setEmojiPicker('reactions')}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="sr-only">{t('callReactFeedbackSection')}</h3>
              <div className="flex gap-2">
                {CALL_FEEDBACK_REACTIONS.map((item) => (
                  <FeedbackReactionButton
                    key={item.id}
                    id={item.id}
                    disabled={disabled}
                    label={t(`callReactFeedback_${item.id}`)}
                    onPick={() => handleSend(item.emoji, 'default')}
                  />
                ))}
              </div>
            </section>

            <div className="space-y-2 border-t border-zinc-700/60 pt-2">
              <button
                type="button"
                disabled={disabled}
                data-testid="call-raise-hand-button"
                className={cn(
                  actionRowBtn,
                  localHandRaised &&
                    (isFull
                      ? 'ring-1 ring-amber-500/50 bg-amber-950/50'
                      : 'ring-1 ring-amber-500/40 bg-amber-500/15'),
                )}
                onClick={() => {
                  onToggleRaiseHand();
                  setOpen(false);
                }}
              >
                <span className="text-lg" aria-hidden>
                  ✋
                </span>
                {localHandRaised ? t('callLowerHand') : t('callRaiseHand')}
              </button>
              <button
                type="button"
                disabled={disabled}
                data-testid="call-be-right-back-button"
                className={actionRowBtn}
                onClick={() => handleSend(CALL_BE_RIGHT_BACK_EMOJI, 'default')}
              >
                <span className="text-lg" aria-hidden>
                  {CALL_BE_RIGHT_BACK_EMOJI}
                </span>
                {t('callReactBeRightBack')}
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
