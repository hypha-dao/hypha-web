'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  Copy,
  Link2,
  MoreHorizontal,
  Pencil,
  Reply,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useIsMobile,
  usePrefersCoarsePointer,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  stripMatrixReplyFallback,
  replacePlainTextMatrixMxidsWithLabels,
} from '@hypha-platform/core/client';
import { usePathname } from 'next/navigation';

import { HumanChatPanelEmojiMartSurface } from './human-chat-panel-emoji-mart-surface';
import type { ChatPanelAttachmentMedia } from './chat-panel-media-types';
import { buildHyphaChatMessageUrl } from './human-chat-message-link';
import { touchComposerFromViewportFlags } from './touch-composer-flags';

const RECENT_REACTIONS_STORAGE_KEY = 'hypha-chat-recent-reactions';
const RECENT_REACTIONS_BUMP_EVENT = 'hypha-chat-recent-reactions-bump';
const DEFAULT_QUICK_REACTIONS = ['👍', '🎵', '🙏', '✅'] as const;
/**
 * Discord-style hold before the mobile action sheet opens.
 * Stay under iOS’s ~500ms loupe/selection timer so our sheet wins the gesture.
 */
const TOUCH_LONG_PRESS_MS = 350;
const TOUCH_LONG_PRESS_MOVE_PX = 12;

function clearNativeTextSelection() {
  try {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
  } catch {
    // ignore
  }
}

/** Plain buttons so MenuSections can render inside a bottom Sheet. */
function SheetMenuItem({
  children,
  onSelect,
  disabled,
  className,
}: {
  children?: ReactNode;
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-3 text-left text-sm outline-none',
        'hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      onClick={(event) => {
        onSelect?.(event.nativeEvent);
      }}
    >
      {children}
    </button>
  );
}

function SheetMenuSeparator({ className }: { className?: string }) {
  return (
    <div className={cn('my-1 h-px bg-border', className)} role="separator" />
  );
}

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

function readRecentReactions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_REACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    );
  } catch {
    return [];
  }
}

export function pushRecentChatReaction(emoji: string) {
  try {
    const prev = readRecentReactions().filter((e) => e !== emoji);
    const next = [emoji, ...prev].slice(0, 32);
    localStorage.setItem(RECENT_REACTIONS_STORAGE_KEY, JSON.stringify(next));
    globalThis.dispatchEvent?.(new Event(RECENT_REACTIONS_BUMP_EVENT));
  } catch {
    // ignore
  }
}

/** Plain message body for copy / TTS only (no attachment filename fallback). */
function getMessagePlainTextBody(m: { parts?: UIMessagePart[] }): string {
  const textParts =
    m.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  return stripMatrixReplyFallback(textParts.map((p) => p.text).join(''));
}

export type HumanChatPanelMessageOverflowProps = {
  roomId: string | null;
  messageId: string;
  /** True for welcome / system rows — no menu. */
  disabled?: boolean;
  canReact?: boolean;
  onReact?: (emoji: string) => void | Promise<void>;
  onEdit?: () => void;
  onReply?: () => void;
  /** Match hover bar: disable Edit in overflow when false even if `onEdit` is set. */
  menuCanEdit?: boolean;
  /** Match hover bar: disable Reply in overflow when false even if `onReply` is set. */
  menuCanReply?: boolean;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  /** Current Matrix user id; used for delete permission. */
  currentUserId?: string | null;
  /** Touch: skip hover context-menu and keep the ⋯ menu modal / on-screen. */
  isTouchComposer?: boolean;
  /** Message author MXID when known (for delete permission). */
  senderMatrixId?: string;
  /** Resolve `@mxid` tokens to human labels for read-aloud. */
  resolveMatrixMemberLabel?: (matrixUserId: string) => string;
  message: {
    parts?: UIMessagePart[];
    media?: ChatPanelAttachmentMedia;
    mediaSlots?: ChatPanelAttachmentMedia[];
  };
  /**
   * Row content; pass a function to receive the ⋯ dropdown trigger node
   * (place it inside the floating action bar).
   */
  children: ReactNode | ((moreMenuTrigger: ReactNode) => ReactNode);
};

function useQuickReactions(): string[] {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setRecent(readRecentReactions());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_REACTIONS_STORAGE_KEY) {
        refresh();
      }
    };
    globalThis.addEventListener?.('storage', onStorage);
    globalThis.addEventListener?.(RECENT_REACTIONS_BUMP_EVENT, refresh);
    return () => {
      globalThis.removeEventListener?.('storage', onStorage);
      globalThis.removeEventListener?.(RECENT_REACTIONS_BUMP_EVENT, refresh);
    };
  }, []);

  return useMemo(() => {
    const out: string[] = [];
    for (const e of recent) {
      if (out.length >= 4) break;
      if (!out.includes(e)) out.push(e);
    }
    for (const e of DEFAULT_QUICK_REACTIONS) {
      if (out.length >= 4) break;
      if (!out.includes(e)) out.push(e);
    }
    return out.slice(0, 4);
  }, [recent]);
}

function MenuSections({
  t,
  quickEmojis,
  canReact,
  onReact,
  onEdit,
  onReply,
  canEdit,
  canReply,
  canCopy,
  onCopyText,
  onCopyLink,
  copyMessageLinkTarget,
  onSpeak,
  canDelete,
  onRequestDelete,
  onAfterAddReaction,
  onAfterQuickReaction,
  onOpenFullReactionPicker,
  Sub,
  SubTrigger,
  SubContent,
  Item,
  Separator,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  quickEmojis: string[];
  canReact: boolean;
  onReact?: (emoji: string) => void | Promise<void>;
  onEdit?: () => void;
  onReply?: () => void;
  canEdit: boolean;
  canReply: boolean;
  canCopy: boolean;
  onCopyText: () => void;
  onCopyLink: () => void;
  copyMessageLinkTarget: string;
  onSpeak: () => void;
  canDelete: boolean;
  onRequestDelete: () => void;
  /** e.g. close ⋯ dropdown after picking from full picker */
  onAfterAddReaction?: () => void;
  /** Close menu after tapping a quick emoji (top row). */
  onAfterQuickReaction?: () => void;
  /** Touch: open the emoji grid inside this menu instead of a hover submenu. */
  onOpenFullReactionPicker?: () => void;
  Sub: typeof ContextMenuSub | typeof DropdownMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent;
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
}) {
  const handleQuickReact = (emoji: string) => {
    if (!onReact) return;
    pushRecentChatReaction(emoji);
    void onReact(emoji);
    onAfterQuickReaction?.();
  };

  return (
    <>
      <div className="flex gap-1 px-1 pb-1 pt-0.5">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={!canReact || !onReact}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-lg transition-colors hover:bg-muted',
              (!canReact || !onReact) && 'pointer-events-none opacity-40',
            )}
            aria-label={t('contextReactWith', { emoji })}
            onClick={() => handleQuickReact(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      {onOpenFullReactionPicker ? (
        <Item
          disabled={!canReact || !onReact}
          onSelect={(event) => {
            event.preventDefault();
            if (canReact && onReact) onOpenFullReactionPicker();
          }}
        >
          <span className="flex-1">{t('addReactionButton')}</span>
        </Item>
      ) : (
        <Sub>
          <SubTrigger
            disabled={!canReact || !onReact}
            className="flex cursor-pointer items-center gap-2 pr-1"
          >
            <span className="flex-1">{t('addReactionButton')}</span>
          </SubTrigger>
          <SubContent
            sideOffset={2}
            data-testid="hypha-emoji-picker-panel"
            className="w-[min(calc(100vw-2rem),22rem)] max-w-[min(22rem,calc(100vw-1rem))] overflow-hidden border-border p-0 shadow-lg"
            onWheel={(event) => event.stopPropagation()}
            onEscapeKeyDown={(event) => {
              event.stopPropagation();
            }}
          >
            <HumanChatPanelEmojiMartSurface
              ariaLabel={t('addReactionButton')}
              onEmojiSelect={(native) => {
                pushRecentChatReaction(native);
                if (onReact) void onReact(native);
                onAfterAddReaction?.();
              }}
            />
          </SubContent>
        </Sub>
      )}
      <Separator />
      <Item
        disabled={!canEdit}
        onSelect={() => {
          if (canEdit) onEdit?.();
        }}
      >
        <span className="flex-1">{t('contextEditMessage')}</span>
        <Pencil className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Item
        disabled={!canReply}
        onSelect={() => {
          if (canReply) onReply?.();
        }}
      >
        <span className="flex-1">{t('contextReply')}</span>
        <Reply className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Separator />
      <Item
        disabled={!canCopy}
        onSelect={() => {
          if (canCopy) void onCopyText();
        }}
      >
        <span className="flex-1">{t('contextCopyText')}</span>
        <Copy className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Item
        disabled={!copyMessageLinkTarget}
        onSelect={() => {
          if (copyMessageLinkTarget) void onCopyLink();
        }}
      >
        <span className="flex-1">{t('contextCopyMessageLink')}</span>
        <Link2 className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Item
        disabled={!canCopy}
        onSelect={() => {
          if (canCopy) onSpeak();
        }}
      >
        <span className="flex-1">{t('contextSpeakMessage')}</span>
        <Volume2 className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Separator />
      <Item
        disabled={!canDelete}
        className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
        onSelect={() => {
          if (canDelete) onRequestDelete();
        }}
      >
        <span className="flex-1">{t('contextDeleteMessage')}</span>
        <Trash2 className="size-4 shrink-0 opacity-80" aria-hidden />
      </Item>
    </>
  );
}

export function HumanChatPanelMessageOverflow({
  roomId,
  messageId,
  disabled = false,
  canReact = false,
  onReact,
  onEdit,
  onReply,
  menuCanEdit,
  menuCanReply,
  onDeleteMessage,
  currentUserId,
  senderMatrixId,
  isTouchComposer,
  resolveMatrixMemberLabel,
  message,
  children,
}: HumanChatPanelMessageOverflowProps) {
  const t = useTranslations('HumanChatPanel');
  const pathname = usePathname() ?? '';
  const quickEmojis = useQuickReactions();
  const isMobile = useIsMobile();
  const prefersCoarsePointer = usePrefersCoarsePointer();
  const inferredTouch = touchComposerFromViewportFlags(
    isMobile,
    prefersCoarsePointer,
  );
  const touchComposer = isTouchComposer ?? inferredTouch;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOpenedRef = useRef(false);
  const longPressRootRef = useRef<HTMLDivElement>(null);
  const selectionLockRafRef = useRef(0);
  const selectionCssLockRef = useRef(false);

  const stopSelectionLock = useCallback(() => {
    if (selectionLockRafRef.current) {
      cancelAnimationFrame(selectionLockRafRef.current);
      selectionLockRafRef.current = 0;
    }
    if (selectionCssLockRef.current && typeof document !== 'undefined') {
      selectionCssLockRef.current = false;
      document.documentElement.style.removeProperty('-webkit-user-select');
      document.documentElement.style.removeProperty('user-select');
    }
  }, []);

  const startSelectionLock = useCallback(() => {
    if (typeof document === 'undefined') return;
    selectionCssLockRef.current = true;
    document.documentElement.style.setProperty('-webkit-user-select', 'none');
    document.documentElement.style.setProperty('user-select', 'none');
    clearNativeTextSelection();
    const tick = () => {
      clearNativeTextSelection();
      selectionLockRafRef.current = requestAnimationFrame(tick);
    };
    if (selectionLockRafRef.current) {
      cancelAnimationFrame(selectionLockRafRef.current);
    }
    selectionLockRafRef.current = requestAnimationFrame(tick);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }, []);

  const openActionSheet = useCallback(() => {
    startSelectionLock();
    clearNativeTextSelection();
    setReactionPickerOpen(false);
    setDropdownOpen(false);
    setActionSheetOpen(true);
  }, [startSelectionLock]);

  useEffect(() => {
    if (!actionSheetOpen) {
      stopSelectionLock();
      clearNativeTextSelection();
    }
  }, [actionSheetOpen, stopSelectionLock]);

  useEffect(
    () => () => {
      clearLongPressTimer();
      stopSelectionLock();
    },
    [clearLongPressTimer, stopSelectionLock],
  );

  /*
   * iOS WebKit still starts a text selection / callout on long-press even with
   * `user-select: none`. Block `selectstart` so only the Discord-style sheet
   * appears; pointer handlers clear ranges while the gesture is active.
   */
  useEffect(() => {
    if (!touchComposer) return;
    const el = longPressRootRef.current;
    if (!el) return;
    const onSelectStart = (event: Event) => {
      event.preventDefault();
    };
    el.addEventListener('selectstart', onSelectStart);
    return () => {
      el.removeEventListener('selectstart', onSelectStart);
    };
  }, [touchComposer]);

  const plain = useMemo(() => getMessagePlainTextBody(message), [message]);
  const speakablePlain = useMemo(() => {
    if (!plain.trim()) return '';
    if (!resolveMatrixMemberLabel) return plain;
    return replacePlainTextMatrixMxidsWithLabels(
      plain,
      resolveMatrixMemberLabel,
    );
  }, [plain, resolveMatrixMemberLabel]);
  const canCopy = plain.trim().length > 0;
  const canEdit = menuCanEdit ?? Boolean(onEdit);
  const canReply = menuCanReply ?? Boolean(onReply);
  const canDelete =
    Boolean(onDeleteMessage) &&
    Boolean(roomId) &&
    Boolean(currentUserId) &&
    Boolean(senderMatrixId) &&
    senderMatrixId === currentUserId &&
    !messageId.startsWith('hypha-send-pending') &&
    messageId !== 'welcome';

  const copyMessageLinkTarget = useMemo(() => {
    if (!roomId || !messageId || messageId === 'welcome') return '';
    return buildHyphaChatMessageUrl(pathname, roomId, messageId) ?? '';
  }, [pathname, roomId, messageId]);

  const onCopyText = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      // ignore
    }
  }, [canCopy, plain]);

  const onCopyLink = useCallback(async () => {
    if (!copyMessageLinkTarget) return;
    try {
      await navigator.clipboard.writeText(copyMessageLinkTarget);
    } catch {
      // ignore
    }
  }, [copyMessageLinkTarget]);

  const onSpeak = useCallback(() => {
    if (
      !speakablePlain.trim() ||
      typeof globalThis.speechSynthesis === 'undefined'
    ) {
      return;
    }
    globalThis.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakablePlain);
    u.lang = document.documentElement.lang || 'en';
    globalThis.speechSynthesis.speak(u);
  }, [speakablePlain]);

  const confirmDelete = useCallback(async () => {
    if (!canDelete || !onDeleteMessage || deleteBusy) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await onDeleteMessage(messageId);
      setDeleteOpen(false);
      setDropdownOpen(false);
      setActionSheetOpen(false);
    } catch {
      setDeleteError(t('messageDeleteFailed'));
    } finally {
      setDeleteBusy(false);
    }
  }, [canDelete, deleteBusy, messageId, onDeleteMessage, t]);

  const closeActionSheet = useCallback(() => {
    setActionSheetOpen(false);
    setReactionPickerOpen(false);
  }, []);

  if (disabled) {
    return typeof children === 'function' ? (
      <>{children(null)}</>
    ) : (
      <>{children}</>
    );
  }

  const menuPropsBase = {
    t,
    quickEmojis,
    canReact,
    onReact,
    onEdit,
    onReply,
    canEdit,
    canReply,
    canCopy,
    onCopyText,
    onCopyLink,
    copyMessageLinkTarget,
    onSpeak,
    canDelete,
    onRequestDelete: () => {
      setActionSheetOpen(false);
      setDropdownOpen(false);
      setDeleteOpen(true);
    },
  } as const;

  const contextMenu = (
    <MenuSections
      {...menuPropsBase}
      onAfterAddReaction={undefined}
      onAfterQuickReaction={() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
          }),
        );
      }}
      Sub={ContextMenuSub}
      SubTrigger={ContextMenuSubTrigger}
      SubContent={ContextMenuSubContent}
      Item={ContextMenuItem}
      Separator={ContextMenuSeparator}
    />
  );

  /** Desktop ⋯ only — touch opens the bottom sheet instead. */
  const dropdownMenu = (
    <MenuSections
      {...menuPropsBase}
      onAfterAddReaction={() => setDropdownOpen(false)}
      onAfterQuickReaction={() => setDropdownOpen(false)}
      Sub={DropdownMenuSub}
      SubTrigger={DropdownMenuSubTrigger}
      SubContent={DropdownMenuSubContent}
      Item={DropdownMenuItem}
      Separator={DropdownMenuSeparator}
    />
  );

  const sheetMenu = reactionPickerOpen ? (
    <HumanChatPanelEmojiMartSurface
      ariaLabel={t('addReactionButton')}
      onEmojiSelect={(native) => {
        pushRecentChatReaction(native);
        if (onReact) void onReact(native);
        closeActionSheet();
      }}
    />
  ) : (
    <MenuSections
      {...menuPropsBase}
      onAfterAddReaction={closeActionSheet}
      onAfterQuickReaction={closeActionSheet}
      onOpenFullReactionPicker={() => setReactionPickerOpen(true)}
      onEdit={
        onEdit
          ? () => {
              closeActionSheet();
              onEdit();
            }
          : undefined
      }
      onReply={
        onReply
          ? () => {
              closeActionSheet();
              onReply();
            }
          : undefined
      }
      onCopyText={() => {
        void onCopyText();
        closeActionSheet();
      }}
      onCopyLink={() => {
        void onCopyLink();
        closeActionSheet();
      }}
      onSpeak={() => {
        onSpeak();
        closeActionSheet();
      }}
      Sub={DropdownMenuSub}
      SubTrigger={DropdownMenuSubTrigger}
      SubContent={DropdownMenuSubContent}
      Item={SheetMenuItem as typeof DropdownMenuItem}
      Separator={SheetMenuSeparator as typeof DropdownMenuSeparator}
    />
  );

  const moreSlot = touchComposer ? (
    <button
      type="button"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:block"
      aria-label={t('moreButton')}
      aria-expanded={actionSheetOpen}
      onClick={(event) => {
        event.stopPropagation();
        openActionSheet();
      }}
    >
      <MoreHorizontal className="h-3 w-3" strokeWidth={2} aria-hidden />
    </button>
  ) : (
    <DropdownMenu
      open={dropdownOpen}
      onOpenChange={(open) => {
        setDropdownOpen(open);
        if (!open) setReactionPickerOpen(false);
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:block"
          aria-label={t('moreButton')}
          aria-expanded={dropdownOpen}
        >
          <MoreHorizontal className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
        className="min-w-[220px] p-1"
      >
        {dropdownMenu}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const rowInner =
    typeof children === 'function' ? children(moreSlot) : children;

  return (
    <>
      {touchComposer ? (
        <div
          ref={longPressRootRef}
          className="select-none [-webkit-touch-callout:none] [&_*]:select-none [&_*]:[-webkit-touch-callout:none]"
          data-chat-message-long-press=""
          onPointerDownCapture={(event) => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
              return;
            }
            if (event.button !== 0) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (
              target.closest(
                'button, a, input, textarea, [role="menuitem"], [data-chat-message-actions]',
              )
            ) {
              return;
            }
            clearLongPressTimer();
            longPressOpenedRef.current = false;
            clearNativeTextSelection();
            startSelectionLock();
            longPressOriginRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
            longPressTimerRef.current = setTimeout(() => {
              longPressTimerRef.current = null;
              longPressOpenedRef.current = true;
              openActionSheet();
            }, TOUCH_LONG_PRESS_MS);
          }}
          onPointerMoveCapture={(event) => {
            const origin = longPressOriginRef.current;
            if (!origin || longPressTimerRef.current == null) return;
            const dx = event.clientX - origin.x;
            const dy = event.clientY - origin.y;
            if (
              dx * dx + dy * dy >
              TOUCH_LONG_PRESS_MOVE_PX * TOUCH_LONG_PRESS_MOVE_PX
            ) {
              clearLongPressTimer();
              stopSelectionLock();
            }
          }}
          onPointerUpCapture={(event) => {
            clearLongPressTimer();
            if (!longPressOpenedRef.current) {
              stopSelectionLock();
              return;
            }
            longPressOpenedRef.current = false;
            // Suppress the tap that would toggle the floating mini toolbar.
            event.stopPropagation();
            clearNativeTextSelection();
          }}
          onPointerCancelCapture={() => {
            clearLongPressTimer();
            longPressOpenedRef.current = false;
            stopSelectionLock();
          }}
          onContextMenu={(event) => {
            // Native callout / text select — long-press owns this gesture.
            event.preventDefault();
            clearNativeTextSelection();
          }}
        >
          {rowInner}
        </div>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>{rowInner}</ContextMenuTrigger>
          <ContextMenuContent className="min-w-[220px] p-1">
            {contextMenu}
          </ContextMenuContent>
        </ContextMenu>
      )}

      {touchComposer ? (
        /*
         * Always Dialog — never Sheet. Chat already lives in a mobile Sheet; a
         * nested Sheet focus trap has crashed the messages ErrorBoundary
         * (header + composer stay; center shows “This chat view crashed”).
         */
        <Dialog
          open={actionSheetOpen}
          onOpenChange={(open) => {
            setActionSheetOpen(open);
            if (!open) setReactionPickerOpen(false);
          }}
        >
          <DialogContent
            hideCloseButton
            overlayClassName="bg-black/45"
            className={cn(
              /* Bottom sheet layout — override centered Dialog defaults */
              'left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0',
              'max-h-[min(85vh,640px)] gap-0 rounded-t-2xl border-border p-0',
              'pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-t-2xl',
              'bg-background font-sans text-foreground shadow-lg',
            )}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t('moreButton')}</DialogTitle>
              <DialogDescription>{t('moreButton')}</DialogDescription>
            </DialogHeader>
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
              aria-hidden
            />
            <div
              className={cn(
                'overflow-y-auto px-2 pb-2 pt-3',
                reactionPickerOpen && 'px-0 pt-0',
              )}
            >
              {sheetMenu}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteError(null);
            setDeleteBusy(false);
          }
        }}
      >
        <AlertDialogContent overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('contextDeleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('contextDeleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={deleteBusy} className="h-10">
              {t('contextDeleteCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="default"
              colorVariant="error"
              className="h-10"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? t('loading') : t('contextDeleteConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
