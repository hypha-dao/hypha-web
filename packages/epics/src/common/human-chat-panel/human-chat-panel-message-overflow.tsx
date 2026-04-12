'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  ChevronRight,
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { stripMatrixReplyFallback } from '@hypha-platform/core/client';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import type { ChatPanelAttachmentMedia } from './chat-panel-media-types';

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

function getMessagePlainTextForCopy(m: {
  parts?: UIMessagePart[];
  media?: ChatPanelAttachmentMedia;
  mediaSlots?: ChatPanelAttachmentMedia[];
}): string {
  const textParts =
    m.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const fromParts = stripMatrixReplyFallback(
    textParts.map((p) => p.text).join(''),
  );
  if (fromParts.trim()) return fromParts;
  if (m.mediaSlots && m.mediaSlots.length > 0) {
    const names = m.mediaSlots
      .map((s) => s.filename)
      .filter(Boolean) as string[];
    if (names.length) return names.join(', ');
  }
  if (m.media?.filename) return m.media.filename;
  return '';
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
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  /** Current Matrix user id; used for delete permission. */
  currentUserId?: string | null;
  /** Message author MXID when known (for delete permission). */
  senderMatrixId?: string;
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
  addReactionOpen,
  setAddReactionOpen,
  canReact,
  onReact,
  onEdit,
  onReply,
  canEdit,
  canCopy,
  onCopyText,
  onCopyLink,
  onSpeak,
  canDelete,
  onRequestDelete,
  Item,
  Separator,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  quickEmojis: string[];
  addReactionOpen: boolean;
  setAddReactionOpen: (o: boolean) => void;
  canReact: boolean;
  onReact?: (emoji: string) => void | Promise<void>;
  onEdit?: () => void;
  onReply?: () => void;
  canEdit: boolean;
  canCopy: boolean;
  onCopyText: () => void;
  onCopyLink: () => void;
  onSpeak: () => void;
  canDelete: boolean;
  onRequestDelete: () => void;
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
}) {
  const handleQuickReact = (emoji: string) => {
    if (!onReact) return;
    pushRecentChatReaction(emoji);
    void onReact(emoji);
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
      <HumanChatPanelEmojiPicker
        open={addReactionOpen}
        onOpenChange={setAddReactionOpen}
        onEmojiSelect={(native) => {
          pushRecentChatReaction(native);
          if (onReact) void onReact(native);
        }}
        ariaLabel={t('addReactionButton')}
        align="start"
      >
        <Item
          className="flex cursor-pointer items-center justify-between gap-2 pr-1"
          onSelect={(e) => {
            e.preventDefault();
            setAddReactionOpen(true);
          }}
        >
          <span>{t('addReactionButton')}</span>
          <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
        </Item>
      </HumanChatPanelEmojiPicker>
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
      <Item onSelect={() => onReply?.()}>
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
      <Item onSelect={() => void onCopyLink()}>
        <span className="flex-1">{t('contextCopyMessageLink')}</span>
        <Link2 className="size-4 shrink-0 opacity-70" aria-hidden />
      </Item>
      <Item onSelect={onSpeak}>
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
  onDeleteMessage,
  currentUserId,
  senderMatrixId,
  message,
  children,
}: HumanChatPanelMessageOverflowProps) {
  const t = useTranslations('HumanChatPanel');
  const quickEmojis = useQuickReactions();
  const [addReactionOpen, setAddReactionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const plain = useMemo(() => getMessagePlainTextForCopy(message), [message]);
  const canCopy = plain.trim().length > 0;
  const canEdit = Boolean(onEdit);
  const canDelete =
    Boolean(onDeleteMessage) &&
    Boolean(roomId) &&
    Boolean(currentUserId) &&
    Boolean(senderMatrixId) &&
    senderMatrixId === currentUserId &&
    !messageId.startsWith('hypha-send-pending') &&
    messageId !== 'welcome';

  const matrixToLink = useMemo(() => {
    if (!roomId || !messageId || messageId === 'welcome') return '';
    const encRoom = encodeURIComponent(roomId);
    const encEv = encodeURIComponent(messageId);
    return `https://matrix.to/#/${encRoom}/${encEv}`;
  }, [roomId, messageId]);

  const onCopyText = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      // ignore
    }
  }, [canCopy, plain]);

  const onCopyLink = useCallback(async () => {
    if (!matrixToLink) return;
    try {
      await navigator.clipboard.writeText(matrixToLink);
    } catch {
      // ignore
    }
  }, [matrixToLink]);

  const onSpeak = useCallback(() => {
    if (!plain.trim() || typeof globalThis.speechSynthesis === 'undefined') {
      return;
    }
    globalThis.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = document.documentElement.lang || 'en';
    globalThis.speechSynthesis.speak(u);
  }, [plain]);

  const confirmDelete = useCallback(async () => {
    if (!canDelete || !onDeleteMessage) return;
    setDeleteOpen(false);
    setDropdownOpen(false);
    await onDeleteMessage(messageId);
  }, [canDelete, messageId, onDeleteMessage]);

  if (disabled) {
    return typeof children === 'function' ? (
      <>{children(null)}</>
    ) : (
      <>{children}</>
    );
  }

  const menuProps = {
    t,
    quickEmojis,
    addReactionOpen,
    setAddReactionOpen,
    canReact,
    onReact,
    onEdit,
    onReply,
    canEdit,
    canCopy,
    onCopyText,
    onCopyLink,
    onSpeak,
    canDelete,
    onRequestDelete: () => setDeleteOpen(true),
  } as const;

  const contextMenu = (
    <MenuSections
      {...menuProps}
      Item={ContextMenuItem}
      Separator={ContextMenuSeparator}
    />
  );

  const dropdownMenu = (
    <MenuSections
      {...menuProps}
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('contextDeleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('contextDeleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('contextDeleteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {t('contextDeleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
