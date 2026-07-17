'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronUp, Ellipsis, Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useIsMobile } from '@hypha-platform/ui';
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
  callAccentToolbarHeartActive,
  callAccentToolbarMenuRowActive,
} from './call-accent-alert-styles';

type HumanChatPanelCallReactPopoverProps = {
  disabled?: boolean;
  /** Emoji reactions need the Matrix session anchor; raise hand does not. */
  reactionsSendReady?: boolean;
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
  isFull,
  className,
}: {
  emoji: string;
  disabled: boolean;
  label: string;
  onPick: () => void;
  isFull: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none transition-colors disabled:opacity-50',
        isFull
          ? 'bg-zinc-800/90 hover:bg-zinc-700'
          : 'border border-border/80 bg-muted/90 hover:bg-muted dark:border-zinc-600/50 dark:bg-zinc-800/90 dark:hover:bg-zinc-700',
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
  isFull,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  isFull: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50',
        isFull
          ? 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700'
          : 'border border-border/80 bg-muted/90 text-muted-foreground hover:bg-muted dark:border-zinc-600/50 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700',
      )}
      onClick={onClick}
    >
      <Ellipsis className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function FeedbackReactionButton({
  id,
  disabled,
  label,
  onPick,
  isFull,
}: {
  id: CallFeedbackReactionId;
  disabled: boolean;
  label: string;
  onPick: () => void;
  isFull: boolean;
}) {
  const base =
    'inline-flex h-7 min-w-0 flex-1 items-center justify-center rounded border text-sm transition-colors disabled:opacity-50';
  /** Neutral chip — grey in light mode, dark zinc in dark mode (matches rewind / coffee). */
  const unifiedStyle = isFull
    ? 'border-zinc-600/50 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90'
    : 'border-border/80 bg-muted/80 text-foreground hover:bg-muted dark:border-zinc-600/50 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/90';
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
      className={cn(base, unifiedStyle)}
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
    <section className="min-h-0">
      <div
        className={cn('flex min-h-0 items-center gap-0.5', sectionTitleClass)}
      >
        <h3 className="min-w-0 flex-1 truncate">{title}</h3>
        {titleHint}
      </div>
      <div className={cn('-mx-0 my-1 h-px', dividerClass)} />
      <div className="min-h-0">{children}</div>
    </section>
  );
}

/** Zoom-style React menu — effects, reactions, feedback, raise hand, be right back. */
export function HumanChatPanelCallReactPopover({
  disabled = false,
  reactionsSendReady = true,
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isFull = variant === 'fullView';
  const isPip = density === 'pip';

  /**
   * PiP's panel has a small max-height, so raise-hand/be-right-back (the
   * bottom row) start below the fold. They're the higher-value actions in a
   * floating window, so land there by default instead of the top section.
   */
  useEffect(() => {
    if (!open || !isPip || emojiPicker) return;
    const node = panelRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [emojiPicker, isPip, open]);

  const setOpen = (next: boolean) => {
    onOpenChangeProp?.(next);
    if (openProp === undefined) {
      setUncontrolledOpen(next);
    }
  };
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

  /** Match capture/recording menu title spacing (`px-2 py-1.5 text-sm font-semibold`). */
  const sectionTitle = cn(
    'px-2 py-1.5 text-sm font-semibold',
    isFull ? 'text-zinc-100' : 'text-foreground',
  );

  const sectionDivider = isFull ? 'bg-zinc-700/60' : 'bg-neutral-6';

  const emojiRowClass = 'flex w-full min-h-0 flex-wrap items-center gap-1.5';

  const actionRowBtn = cn(
    'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium leading-tight transition-colors disabled:opacity-50',
    isFull
      ? 'border-zinc-600/50 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700/90'
      : 'border-border/80 bg-muted text-foreground hover:bg-neutral-3 dark:border-zinc-600/50 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-700/90',
  );

  const reactTriggerActive = open || localHandRaised;
  const emojiActionsDisabled = disabled || !reactionsSendReady;

  const triggerClassName = cn(
    'inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full border shadow-sm transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    isFull
      ? 'box-border h-10 w-10 min-h-10 min-w-10 max-h-10 max-w-10 border-zinc-600/80 bg-zinc-900/90 px-0 text-white hover:bg-zinc-800/95'
      : /** Same footprint in PiP as the embedded dock — no separate compact tier. */
        cn(
          'border-border/60 bg-background text-foreground hover:bg-muted',
          isTouchToolbar ? 'h-11 w-11 px-0' : 'h-8 w-8 px-0',
        ),
  );

  const menuPanelClass = cn(
    /**
     * The embedded (non-PiP) floating dock is a resizable widget with
     * `overflow-hidden`, much shorter than the viewport — `--hypha-call-dock-popover-max-h`
     * (set on the dock root from its actual measured height) additionally
     * caps this so a tall menu can't extend past the dock's own box and get
     * clipped with no way to scroll to the rest. Falls back to effectively
     * unset (9999px) wherever the dock doesn't set it (PiP, fullscreen).
     */
    'absolute bottom-full z-[140] mb-2 max-h-[min(70vh,calc(100dvh-8rem),var(--hypha-call-dock-popover-max-h,9999px))] overflow-y-auto overflow-x-hidden rounded-xl px-2 py-2 shadow-xl',
    isPip
      ? cn(
          /**
           * PiP windows can be narrower than the panel's normal min-width
           * (e.g. 224px filmstrip mode). Anchoring to the trigger's right
           * edge with a fixed min-width pushed the panel past the window's
           * left edge, where the PiP body's `overflow: hidden` silently
           * clipped it. Centering on the trigger keeps it inside the
           * window regardless of size.
           */
          'left-1/2 -translate-x-1/2',
          /**
           * A concrete width, not shrink-to-fit (`w-max`): the feedback row
           * and raise-hand/be-right-back row use `flex-1` children, whose
           * used `flex-basis: 0%` contributes ~nothing to a max-content
           * calculation — under `w-max` the panel collapsed far narrower
           * than its content needed, squashing those rows. The full
           * emoji-mart grid (below) is separately `w-full` up to 352px, so
           * needs the same concrete-width treatment, just a larger cap.
           */
          emojiPicker
            ? 'w-[min(calc(100dvw-1rem),22rem)]'
            : 'w-[min(calc(100dvw-1rem),15.5rem)]',
        )
      : 'right-0 w-[min(100vw-2rem,15.5rem)] min-w-56',
    popoverSurface,
  );

  return (
    <div className="relative" data-call-interactive>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-testid="call-react-trigger"
        data-call-interactive
        className={triggerClassName}
        title={t('callReactButton')}
        aria-label={t('callReactButtonAria')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (!next) setEmojiPicker(null);
        }}
      >
        <Heart
          className={cn(
            'h-4 w-4',
            reactTriggerActive ? callAccentToolbarHeartActive : 'fill-none',
            isFull && !reactTriggerActive && 'text-white',
          )}
          strokeWidth={strokeWidth}
          aria-hidden
        />
        <ChevronUp
          className={cn(
            isFull ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5',
            'shrink-0 opacity-70 transition-transform duration-200',
            open && 'rotate-180',
          )}
          strokeWidth={strokeWidth}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          ref={(node) => {
            panelRef.current = node;
            if (menuContentRef) menuContentRef.current = node;
          }}
          role="menu"
          data-testid="call-react-popover-content"
          data-call-interactive
          className={menuPanelClass}
        >
          {emojiPicker ? (
            <div className="space-y-1.5">
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
            <div className="flex min-h-0 flex-col gap-1">
              <CallReactMenuSection
                title={t('callReactSendWithEffect')}
                dividerClass={sectionDivider}
                sectionTitleClass={sectionTitle}
              >
                <div className={emojiRowClass}>
                  {CALL_SEND_WITH_EFFECT_EMOJIS.map((emoji) => (
                    <ReactionEmojiButton
                      key={`effect-${emoji}`}
                      emoji={emoji}
                      isFull={isFull}
                      disabled={emojiActionsDisabled}
                      label={t('callReactSendEmoji', { emoji })}
                      onPick={() => handleSend(emoji, 'effect')}
                    />
                  ))}
                  <MoreEmojiButton
                    isFull={isFull}
                    disabled={emojiActionsDisabled}
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
                      isFull={isFull}
                      disabled={emojiActionsDisabled}
                      label={t('callReactSendEmoji', { emoji })}
                      onPick={() => handleSend(emoji, 'default')}
                    />
                  ))}
                  <MoreEmojiButton
                    isFull={isFull}
                    disabled={emojiActionsDisabled}
                    label={t('callReactMore')}
                    onClick={() => setEmojiPicker('reactions')}
                  />
                </div>
              </CallReactMenuSection>

              <section className="min-h-0">
                <h3 className="sr-only">{t('callReactFeedbackSection')}</h3>
                <div className="flex w-full min-h-0 gap-1">
                  {CALL_FEEDBACK_REACTIONS.map((item) => (
                    <FeedbackReactionButton
                      key={item.id}
                      id={item.id}
                      isFull={isFull}
                      disabled={emojiActionsDisabled}
                      label={t(`callReactFeedback_${item.id}`)}
                      onPick={() => handleSend(item.emoji, 'default')}
                    />
                  ))}
                </div>
              </section>

              <div
                className={cn(
                  'flex w-full min-h-0 gap-1 border-t pt-1',
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
                  <span className="text-sm leading-none" aria-hidden>
                    ✋
                  </span>
                  <span>
                    {localHandRaised ? t('callLowerHand') : t('callRaiseHand')}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  data-testid="call-be-right-back-button"
                  className={actionRowBtn}
                  onClick={() =>
                    handleSend(CALL_BE_RIGHT_BACK_EMOJI, 'default')
                  }
                >
                  <span className="text-sm leading-none" aria-hidden>
                    {CALL_BE_RIGHT_BACK_EMOJI}
                  </span>
                  <span>{t('callReactBeRightBack')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
