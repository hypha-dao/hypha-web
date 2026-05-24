'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
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

const RECENT_REACTIONS_STORAGE_KEY = 'hypha-chat-recent-reactions';
const RECENT_REACTIONS_BUMP_EVENT = 'hypha-chat-recent-reactions-bump';
const DEFAULT_QUICK_REACTIONS = ['👍', '🎵', '🙏', '✅'] as const;

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
      <Sub>
        <SubTrigger
          disabled={!canReact || !onReact}
          className="flex cursor-pointer items-center gap-2 pr-1"
        >
          <span className="flex-1">{t('addReactionButton')}</span>
        </SubTrigger>
        <SubContent
          sideOffset={2}
          className="w-auto max-w-[min(100vw-2rem,352px)] border-border p-0 shadow-lg"
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
  resolveMatrixMemberLabel,
  message,
  children,
}: HumanChatPanelMessageOverflowProps) {
  const t = useTranslations('HumanChatPanel');
  const pathname = usePathname() ?? '';
  const quickEmojis = useQuickReactions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    } catch {
      setDeleteError(t('messageDeleteFailed'));
    } finally {
      setDeleteBusy(false);
    }
  }, [canDelete, deleteBusy, messageId, onDeleteMessage, t]);

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
    onRequestDelete: () => setDeleteOpen(true),
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

  const moreSlot = (
    <DropdownMenu
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
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
        sideOffset={4}
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
      <ContextMenu>
        <ContextMenuTrigger asChild>{rowInner}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-[220px] p-1">
          {contextMenu}
        </ContextMenuContent>
      </ContextMenu>

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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>
              {t('contextDeleteCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
