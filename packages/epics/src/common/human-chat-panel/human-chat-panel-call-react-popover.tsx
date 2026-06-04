'use client';

import { useState, type ReactNode, type RefObject } from 'react';
import { ChevronUp, CircleHelp, Ellipsis, Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  useIsMobile,
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
import {
  callAccentToolbarMenuRowActive,
  callAccentToolbarTriggerActive,
  callAccentToolbarTriggerIdle,
} from './call-accent-alert-styles';

type HumanChatPanelCallReactPopoverProps = {
  disabled?: boolean;
  localHandRaised: boolean;
  onSendReaction: (emoji: string, style?: CallFloatingReactionStyle) => void;
  onToggleRaiseHand: () => void;
  variant?: 'inBanner' | 'fullView';
  density?: 'default' | 'compact' | 'pip';
  iconStrokeWidth?: number;
  /** Controlled open state — parent coordinates with capture/audio menus. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  menuContentRef?: RefObject<HTMLDivElement | null>;
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
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 text-lg leading-none transition-colors hover:bg-zinc-700 disabled:opacity-50',
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
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
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
    'inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-md border text-base transition-colors disabled:opacity-50';
  const styles: Record<CallFeedbackReactionId, string> = {
    yes: 'border-emerald-600/40 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/80',
    no: 'border-rose-600/40 bg-rose-950/80 text-rose-400 hover:bg-rose-900/80',
    slower:
      'border-zinc-600/50 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90',
    faster: 'border-sky-600/40 bg-sky-950/80 text-sky-300 hover:bg-sky-900/80',
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

function CallReactMenuSection({
  title,
  titleHint,
  dividerClass,
  sectionTitleClass,
  children,
}: {
  title: string;
  titleHint?: ReactNode;
  dividerClass: string;
  sectionTitleClass: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div
        className={cn(
          'flex min-h-0 items-center gap-1 border-b pb-1',
          dividerClass,
        )}
      >
        <h3 className={sectionTitleClass}>{title}</h3>
        {titleHint}
      </div>
      <div className="min-h-0 pt-0.5">{children}</div>
    </section>
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
  iconStrokeWidth,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  triggerRef,
  menuContentRef,
}: HumanChatPanelCallReactPopoverProps) {
  const t = useTranslations('HumanChatPanel');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [emojiPicker, setEmojiPicker] = useState<EmojiPickerPanel>(null);

  const setOpen = (next: boolean) => {
    onOpenChangeProp?.(next);
    if (openProp === undefined) {
      setUncontrolledOpen(next);
    }
  };
  const isFull = variant === 'fullView';
  const isPip = density === 'pip';
  const isTouchToolbar = useIsMobile() ?? false;
  const strokeWidth = iconStrokeWidth ?? (isFull ? 2 : 1.75);

  const handleSend = (
    emoji: string,
    style: CallFloatingReactionStyle = 'default',
  ) => {
    onSendReaction(emoji, style);
    setOpen(false);
    setEmojiPicker(null);
  };

  const popoverSurface = isFull
    ? 'border-zinc-700 bg-zinc-950 text-zinc-100'
    : 'border-border bg-popover text-popover-foreground';

  const sectionTitle = isFull
    ? 'text-sm font-semibold leading-tight text-zinc-100'
    : 'text-xs font-semibold leading-tight text-foreground';

  const sectionDivider = isFull ? 'border-zinc-700/60' : 'border-border/70';

  const emojiRowClass = 'flex min-h-0 flex-wrap items-center gap-1.5';

  const actionRowBtn = cn(
    'flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium leading-tight transition-colors disabled:opacity-50',
    isFull
      ? 'bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700/90'
      : 'bg-muted/80 text-foreground hover:bg-muted',
  );

  const triggerClassName = cn(
    'inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full border shadow-sm transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    isFull
      ? 'h-10 min-h-10 border-zinc-600/80 bg-zinc-900/90 px-2.5 text-white hover:bg-zinc-800/95'
      : isPip
      ? 'h-5 w-5 border-border/60 bg-background/95 px-0 text-foreground'
      : cn(
          callAccentToolbarTriggerIdle,
          isTouchToolbar ? 'h-11 w-11' : 'h-8 w-8',
        ),
    (open || localHandRaised) && !isFull && callAccentToolbarTriggerActive,
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
          ref={triggerRef}
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
              'fill-none',
            )}
            strokeWidth={strokeWidth}
            aria-hidden
          />
          {!isPip ? (
            <ChevronUp
              className={cn(
                isFull ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5',
                'shrink-0 opacity-70 transition-transform duration-200',
                open && 'rotate-180',
              )}
              strokeWidth={strokeWidth}
              aria-hidden
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={menuContentRef}
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        data-testid="call-react-popover-content"
        className={cn(
          'z-[140] w-[min(100vw-2rem,340px)] overflow-hidden rounded-xl p-2 shadow-xl',
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
          <div className="flex min-h-0 flex-col gap-2">
            <CallReactMenuSection
              title={t('callReactSendWithEffect')}
              dividerClass={sectionDivider}
              sectionTitleClass={sectionTitle}
              titleHint={
                <span
                  className="inline-flex text-zinc-500"
                  title={t('callReactSendWithEffectHint')}
                >
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">
                    {t('callReactSendWithEffectHint')}
                  </span>
                </span>
              }
            >
              <div className={emojiRowClass}>
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
            </CallReactMenuSection>

            <CallReactMenuSection
              title={t('callReactReactionsSection')}
              dividerClass={sectionDivider}
              sectionTitleClass={sectionTitle}
            >
              <div className={emojiRowClass}>
                {CALL_STANDARD_REACTION_EMOJIS.map((emoji) => (
                  <ReactionEmojiButton
                    key={`reaction-${emoji}`}
                    emoji={emoji}
                    disabled={disabled}
                    label={t('callReactSendEmoji', { emoji })}
                    onPick={() => handleSend(emoji, 'default')}
                    className={
                      isFull
                        ? 'bg-transparent hover:bg-zinc-800/60'
                        : 'bg-transparent hover:bg-muted/80'
                    }
                  />
                ))}
                <MoreEmojiButton
                  disabled={disabled}
                  label={t('callReactMore')}
                  onClick={() => setEmojiPicker('reactions')}
                />
              </div>
            </CallReactMenuSection>

            <section className="min-h-0 space-y-1">
              <h3 className="sr-only">{t('callReactFeedbackSection')}</h3>
              <div className="flex min-h-0 gap-1.5">
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

            <div
              className={cn(
                'flex min-h-0 flex-col gap-1.5 border-t pt-1.5',
                sectionDivider,
              )}
            >
              <button
                type="button"
                disabled={disabled}
                data-testid="call-raise-hand-button"
                className={cn(
                  actionRowBtn,
                  localHandRaised && callAccentToolbarMenuRowActive,
                )}
                onClick={() => {
                  onToggleRaiseHand();
                  setOpen(false);
                }}
              >
                <span className="text-base leading-none" aria-hidden>
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
                <span className="text-base leading-none" aria-hidden>
                  {CALL_BE_RIGHT_BACK_EMOJI}
                </span>
                {t('callReactBeRightBack')}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
