'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paperclip,
  Image,
  Video,
  Bold,
  Italic,
  Strikethrough,
  Code,
  TextQuote,
  Eye,
  Smile,
  AtSign,
  CornerDownLeft,
  X,
  Mic,
  Loader2,
  Plus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import {
  filterEmojiShortcodes,
  getActiveColonToken,
  loadEmojiSearchIndex,
  type EmojiIndexEntry,
} from './emoji-mart-index';
import { getTextareaSelectionCenter } from './textarea-caret-position';

/** Spec defaults (bytes) */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type ReplyPreview = {
  authorLabel: string;
  excerpt: string;
  onDismiss: () => void;
};

export type ChatMentionCandidate = {
  userId: string;
  label: string;
};

type HumanChatPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  channelName?: string;
  /** Rich reply: composer preview above the textarea */
  replyPreview?: ReplyPreview;
  /** Optional file queued for next send (cleared by parent on success). */
  pendingAttachment: File | null;
  onPendingAttachmentChange: (file: File | null) => void;
  /** Room members for @ typeahead (MXID + display label). */
  mentionCandidates?: ChatMentionCandidate[];
  /** While Matrix upload/send is in progress */
  isSending?: boolean;
};

function insertAtCaret(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
): { next: string; caret: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const next = before + insertion + after;
  const caret = selectionStart + insertion.length;
  return { next, caret };
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end);
  const insertion = `${before}${selected}${after}`;
  const { next } = insertAtCaret(value, start, end, insertion);
  const selStart = start + before.length;
  const selEnd = selStart + selected.length;
  return { next, selStart, selEnd };
}

function getAtMentionToken(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  let i = cursor - 1;
  if (i < 0) return null;
  while (i >= 0 && text[i] !== '@' && text[i] !== ' ' && text[i] !== '\n') {
    i -= 1;
  }
  if (i < 0 || text[i] !== '@') return null;
  if (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n') return null;
  const query = text.slice(i + 1, cursor);
  if (/[\s\n]/.test(query)) return null;
  return { start: i, query };
}

function maxBytesForFile(file: File): number {
  const t = file.type || '';
  if (t.startsWith('image/')) return MAX_IMAGE_BYTES;
  if (t.startsWith('video/')) return MAX_VIDEO_BYTES;
  return MAX_FILE_BYTES;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function HumanChatPanelChatBar({
  value,
  onChange,
  onSend,
  placeholder,
  channelName,
  replyPreview,
  pendingAttachment,
  onPendingAttachmentChange,
  mentionCandidates = [],
  isSending = false,
}: HumanChatPanelChatBarProps) {
  const t = useTranslations('HumanChatPanel');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const replyPreviewWasOpenRef = useRef(false);
  const mentionTokenRef = useRef<{ start: number; query: string } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** Bumped when dictation ends; stale `onresult` handlers must not call `onChange`. */
  const dictationEpochRef = useRef(0);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  /** Controlled so we can close + open another surface in one pointer gesture. */
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const skipNextToolbarClickRef = useRef(false);
  const [colonOpen, setColonOpen] = useState(false);
  const [colonSuggestions, setColonSuggestions] = useState<EmojiIndexEntry[]>(
    [],
  );
  const [colonActive, setColonActive] = useState(0);
  const colonTokenRef = useRef<{ start: number; query: string } | null>(null);
  const colonRequestIdRef = useRef(0);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    ChatMentionCandidate[]
  >([]);
  const [mentionActive, setMentionActive] = useState(0);

  const [selectionBar, setSelectionBar] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [composerError, setComposerError] = useState<string | null>(null);
  const [dictationActive, setDictationActive] = useState(false);

  const updateSelectionBar = useCallback(() => {
    const el = textareaRef.current;
    if (!el || document.activeElement !== el) {
      setSelectionBar(null);
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end || colonOpen || mentionOpen) {
      setSelectionBar(null);
      return;
    }
    const local = getTextareaSelectionCenter(el);
    if (!local) {
      setSelectionBar(null);
      return;
    }
    const taRect = el.getBoundingClientRect();
    const wrap = composerShellRef.current;
    if (!wrap) {
      setSelectionBar(null);
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    setSelectionBar({
      top: local.top + (taRect.top - wrapRect.top),
      left: local.left + (taRect.left - wrapRect.left),
    });
  }, [colonOpen, mentionOpen]);

  useEffect(() => {
    const isOpen = Boolean(replyPreview);
    if (isOpen && !replyPreviewWasOpenRef.current) {
      textareaRef.current?.focus();
    }
    replyPreviewWasOpenRef.current = isOpen;
  }, [replyPreview]);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 192) + 'px';
    }
  }, []);

  /** Parent clears `value` on send without firing textarea onChange — re-sync height */
  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const syncColonState = useCallback((val: string, cursor: number) => {
    const requestId = ++colonRequestIdRef.current;
    const tok = getActiveColonToken(val, cursor);
    colonTokenRef.current = tok;
    if (!tok) {
      setColonOpen(false);
      setColonSuggestions([]);
      setColonActive(0);
      return;
    }
    void loadEmojiSearchIndex().then(({ all }) => {
      if (requestId !== colonRequestIdRef.current) return;
      const current = colonTokenRef.current;
      if (
        !current ||
        current.start !== tok.start ||
        current.query !== tok.query
      ) {
        return;
      }
      const sug = filterEmojiShortcodes(all, tok.query);
      setColonSuggestions(sug);
      setColonActive(0);
      setColonOpen(sug.length > 0);
    });
  }, []);

  const syncMentionState = useCallback(
    (val: string, cursor: number) => {
      const tok = getAtMentionToken(val, cursor);
      mentionTokenRef.current = tok;
      if (!tok || mentionCandidates.length === 0) {
        setMentionOpen(false);
        setMentionSuggestions([]);
        setMentionActive(0);
        return;
      }
      const q = tok.query.toLowerCase();
      const list = mentionCandidates.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.userId.toLowerCase().includes(q),
      );
      setMentionSuggestions(list.slice(0, 8));
      setMentionActive(0);
      setMentionOpen(list.length > 0);
    },
    [mentionCandidates],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      setColonOpen(false);
      setColonSuggestions([]);
      colonTokenRef.current = null;
      return;
    }
    syncColonState(value, el.selectionStart ?? value.length);
  }, [value, syncColonState]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    syncMentionState(value, el.selectionStart ?? value.length);
  }, [value, syncMentionState]);

  const applyColonChoice = useCallback(
    (entry: EmojiIndexEntry) => {
      const el = textareaRef.current;
      const tok = colonTokenRef.current;
      if (!el || !tok) return;
      colonRequestIdRef.current += 1;
      const start = tok.start;
      const end = el.selectionStart ?? value.length;
      const { next, caret } = insertAtCaret(value, start, end, entry.native);
      onChange(next);
      setColonOpen(false);
      setColonSuggestions([]);
      colonTokenRef.current = null;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
        autoResize();
      });
    },
    [value, onChange, autoResize],
  );

  const applyMentionChoice = useCallback(
    (c: ChatMentionCandidate) => {
      if (isSending) return;
      const el = textareaRef.current;
      const tok = mentionTokenRef.current;
      if (!el || !tok) return;
      const start = tok.start;
      const end = el.selectionStart ?? value.length;
      const safeLabel = c.label.replace(/</g, '').replace(/>/g, '').trim();
      const labelPart = safeLabel.length > 0 ? safeLabel : c.userId;
      /** Stable mention: display label + Matrix user id (avoids duplicate-name collisions). */
      const insert = `@${labelPart} <${c.userId}> `;
      const { next, caret } = insertAtCaret(value, start, end, insert);
      onChange(next);
      setMentionOpen(false);
      setMentionSuggestions([]);
      mentionTokenRef.current = null;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
        autoResize();
      });
    },
    [value, onChange, autoResize, isSending],
  );

  useEffect(() => {
    if (colonOpen || mentionOpen) setSelectionBar(null);
  }, [colonOpen, mentionOpen]);

  useEffect(() => {
    const onSel = () => updateSelectionBar();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [updateSelectionBar]);

  const applyFormat = useCallback(
    (
      kind: 'bold' | 'italic' | 'strike' | 'code' | 'spoiler' | 'blockquote',
    ) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (start === end) return;

      let next: string;
      let selStart: number;
      let selEnd: number;

      if (kind === 'bold') {
        const r = wrapSelection(value, start, end, '**', '**');
        ({ next, selStart, selEnd } = r);
      } else if (kind === 'italic') {
        const r = wrapSelection(value, start, end, '*', '*');
        ({ next, selStart, selEnd } = r);
      } else if (kind === 'strike') {
        const r = wrapSelection(value, start, end, '~~', '~~');
        ({ next, selStart, selEnd } = r);
      } else if (kind === 'code') {
        const r = wrapSelection(value, start, end, '`', '`');
        ({ next, selStart, selEnd } = r);
      } else if (kind === 'spoiler') {
        const r = wrapSelection(value, start, end, '||', '||');
        ({ next, selStart, selEnd } = r);
      } else {
        const quoted = value
          .slice(start, end)
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        next = value.slice(0, start) + quoted + value.slice(end);
        selStart = start;
        selEnd = start + quoted.length;
      }

      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selStart, selEnd);
        autoResize();
        updateSelectionBar();
      });
    },
    [value, onChange, autoResize, updateSelectionBar],
  );

  const applyBoldAtCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) {
      applyFormat('bold');
      return;
    }
    const { next, caret } = insertAtCaret(value, start, end, '****');
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret - 2, caret - 2);
      autoResize();
    });
  }, [value, onChange, applyFormat, autoResize]);

  const insertEmoji = useCallback(
    (native: string) => {
      const el = textareaRef.current;
      if (!el) {
        onChange(value + native);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const { next, caret } = insertAtCaret(value, start, end, native);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
        autoResize();
      });
    },
    [value, onChange, autoResize],
  );

  const queueFile = useCallback(
    (file: File | null) => {
      if (!file || isSending) return;
      setComposerError(null);
      const maxB = maxBytesForFile(file);
      if (file.size > maxB) {
        setComposerError(
          t('attachmentTooLarge', {
            max: formatFileSize(maxB),
          }),
        );
        return;
      }
      onPendingAttachmentChange(file);
    },
    [isSending, onPendingAttachmentChange, t],
  );

  const stopDictation = useCallback(() => {
    dictationEpochRef.current += 1;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setDictationActive(false);
  }, []);

  const startDictation = useCallback(() => {
    if (typeof window === 'undefined') return;
    const Ctor =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;
    if (!Ctor) {
      setComposerError(t('dictationUnsupported'));
      return;
    }
    if (dictationActive) {
      stopDictation();
      return;
    }
    setComposerError(null);
    const baseText = value;
    const sessionEpoch = dictationEpochRef.current;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang =
      typeof navigator !== 'undefined'
        ? navigator.language || 'en-US'
        : 'en-US';
    rec.onresult = (ev) => {
      if (
        dictationEpochRef.current !== sessionEpoch ||
        recognitionRef.current !== rec
      ) {
        return;
      }
      let spoken = '';
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i]?.[0];
        if (r?.transcript) spoken += r.transcript;
      }
      const next = baseText + spoken;
      onChange(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        el?.focus();
        const end = next.length;
        el?.setSelectionRange(end, end);
        autoResize();
      });
    };
    rec.onerror = (event: { error?: string; message?: string }) => {
      if (dictationEpochRef.current !== sessionEpoch) return;
      const code =
        typeof event?.error === 'string'
          ? event.error
          : typeof event?.message === 'string'
          ? event.message
          : 'unknown';
      setComposerError(t('dictationError', { code }));
      setDictationActive(false);
      recognitionRef.current = null;
      dictationEpochRef.current += 1;
    };
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
      }
      setDictationActive(false);
    };
    recognitionRef.current = rec;
    setDictationActive(true);
    try {
      rec.start();
    } catch {
      setDictationActive(false);
      recognitionRef.current = null;
      setComposerError(t('dictationUnsupported'));
    }
  }, [dictationActive, value, onChange, autoResize, stopDictation, t]);

  const handleSendClick = useCallback(() => {
    stopDictation();
    onSend();
  }, [onSend, stopDictation]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyBoldAtCaret();
      return;
    }

    if (mentionOpen && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActive((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActive(
          (i) =>
            (i - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const safeIndex = Math.max(
          0,
          Math.min(mentionActive, mentionSuggestions.length - 1),
        );
        const c = mentionSuggestions[safeIndex];
        if (c) applyMentionChoice(c);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        setMentionSuggestions([]);
        mentionTokenRef.current = null;
        return;
      }
    }

    if (colonOpen && colonSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setColonActive((i) => (i + 1) % colonSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setColonActive(
          (i) => (i - 1 + colonSuggestions.length) % colonSuggestions.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const safeIndex = Math.max(
          0,
          Math.min(colonActive, colonSuggestions.length - 1),
        );
        const entry = colonSuggestions[safeIndex];
        if (entry) applyColonChoice(entry);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        colonRequestIdRef.current += 1;
        setColonOpen(false);
        setColonSuggestions([]);
        colonTokenRef.current = null;
        return;
      }
    }

    if (e.key === 'Escape' && !colonOpen && !mentionOpen) {
      if (dictationActive) {
        e.preventDefault();
        stopDictation();
        return;
      }
      if (pendingAttachment) {
        e.preventDefault();
        if (!isSending) onPendingAttachmentChange(null);
        return;
      }
      if (replyPreview) {
        e.preventDefault();
        if (!isSending) replyPreview.onDismiss();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim().length > 0 || pendingAttachment) {
        if (!isSending) handleSendClick();
      }
    }
  };

  const canSend =
    (value.trim().length > 0 || Boolean(pendingAttachment)) && !isSending;

  const defaultPlaceholder = channelName
    ? t('placeholderChannel', { channel: channelName })
    : t('placeholder');

  const handleMention = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}@`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const { next, caret } = insertAtCaret(value, start, start, '@');
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      syncMentionState(next, caret);
      autoResize();
    });
  }, [value, onChange, autoResize, syncMentionState]);

  /** One tap: dismiss attach menu then run action (avoids “click twice” when switching surfaces). */
  const switchFromAttachMenu = useCallback(
    (e: React.PointerEvent, action: () => void) => {
      if (!attachMenuOpen || isSending) return;
      e.preventDefault();
      e.stopPropagation();
      skipNextToolbarClickRef.current = true;
      setAttachMenuOpen(false);
      requestAnimationFrame(() => {
        action();
      });
    },
    [attachMenuOpen, isSending],
  );

  const onToolbarClickAfterAttachSwitch = useCallback((action: () => void) => {
    if (skipNextToolbarClickRef.current) {
      skipNextToolbarClickRef.current = false;
      return;
    }
    action();
  }, []);

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSending) return;
    const items = e.clipboardData?.files;
    if (!items?.length) return;
    const f = items[0];
    if (f && f.type.startsWith('image/')) {
      e.preventDefault();
      queueFile(f);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isSending) return;
    const f = e.dataTransfer.files?.[0];
    if (f) queueFile(f);
  };

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (
        window as unknown as {
          SpeechRecognition?: unknown;
          webkitSpeechRecognition?: unknown;
        }
      ).SpeechRecognition ??
        (
          window as unknown as {
            webkitSpeechRecognition?: unknown;
          }
        ).webkitSpeechRecognition,
    );

  /** Unified toolbar control: light accent fill + icon color on hover (all actions + send). */
  const toolbarIconButtonClass =
    'flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors ' +
    'hover:bg-accent-3 hover:text-accent-11 active:bg-accent-4/90 active:text-accent-12 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ' +
    'disabled:pointer-events-none disabled:opacity-40';

  const fmtBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-popover-foreground transition-colors hover:bg-white/10';

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 px-3 pt-4 pb-4">
      {composerError && (
        <div
          role="alert"
          className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {composerError}
        </div>
      )}
      <div
        ref={composerShellRef}
        title={t('newlineHintExtended')}
        className={cn(
          'relative flex min-w-0 flex-col overflow-hidden rounded-lg bg-muted/40 shadow-sm',
          'ring-1 ring-border/70 dark:bg-muted/25 dark:ring-white/[0.08]',
          'transition-[box-shadow,ring-color] duration-200',
          'focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/35',
        )}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0] ?? null;
            ev.target.value = '';
            queueFile(f);
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0] ?? null;
            ev.target.value = '';
            queueFile(f);
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          aria-hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0] ?? null;
            ev.target.value = '';
            queueFile(f);
          }}
        />

        {selectionBar && (
          <>
            <div
              className="pointer-events-none absolute z-30 w-0 -translate-x-1/2"
              style={{
                left: selectionBar.left,
                top: Math.max(4, selectionBar.top - 8),
              }}
              aria-hidden
            >
              <div className="h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-zinc-900 dark:border-t-zinc-800" />
            </div>
            <div
              role="toolbar"
              aria-label={t('formatSelectionBar')}
              className="absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg bg-zinc-900 px-1 py-1 shadow-xl dark:bg-zinc-800"
              style={{
                left: selectionBar.left,
                top: Math.max(4, selectionBar.top - 10),
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className={fmtBtn}
                title={t('bold')}
                aria-label={t('bold')}
                onClick={() => applyFormat('bold')}
              >
                <Bold className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('italic')}
                aria-label={t('italic')}
                onClick={() => applyFormat('italic')}
              >
                <Italic className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('strikethrough')}
                aria-label={t('strikethrough')}
                onClick={() => applyFormat('strike')}
              >
                <Strikethrough className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('blockquote')}
                aria-label={t('blockquote')}
                onClick={() => applyFormat('blockquote')}
              >
                <TextQuote className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('inlineCode')}
                aria-label={t('inlineCode')}
                onClick={() => applyFormat('code')}
              >
                <Code className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('spoiler')}
                aria-label={t('spoiler')}
                onClick={() => applyFormat('spoiler')}
              >
                <Eye className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </>
        )}
        {replyPreview && (
          <div
            data-testid="chat-reply-preview"
            className="flex items-start gap-2 border-b border-border px-2.5 py-1.5 sm:px-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {replyPreview.authorLabel}
                </span>
                <span className="text-muted-foreground"> — </span>
                <span>{replyPreview.excerpt}</span>
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('replyDismiss')}
              title={t('replyDismiss')}
              disabled={isSending}
              onClick={() => {
                if (!isSending) replyPreview.onDismiss();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {pendingAttachment && (
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 sm:px-3">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {t('pendingAttachment')}
              </span>{' '}
              {pendingAttachment.name} ({formatFileSize(pendingAttachment.size)}
              )
            </span>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('removeAttachment')}
              title={t('removeAttachment')}
              disabled={isSending}
              onClick={() => {
                if (!isSending) onPendingAttachmentChange(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {mentionOpen && mentionSuggestions.length > 0 && (
          <div
            role="listbox"
            aria-label={t('mentionListLabel')}
            className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          >
            {mentionSuggestions.map((c, idx) => (
              <button
                key={c.userId}
                type="button"
                role="option"
                aria-selected={idx === mentionActive}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm',
                  idx === mentionActive
                    ? 'bg-muted text-foreground'
                    : 'text-foreground hover:bg-muted/80',
                )}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => applyMentionChoice(c)}
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-xs text-muted-foreground">
                  {c.userId}
                </span>
              </button>
            ))}
          </div>
        )}
        {colonOpen && colonSuggestions.length > 0 && (
          <div
            role="listbox"
            aria-label={t('emojiShortcodeListLabel')}
            className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          >
            {colonSuggestions.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={idx === colonActive}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                  idx === colonActive
                    ? 'bg-muted text-foreground'
                    : 'text-foreground hover:bg-muted/80',
                )}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => applyColonChoice(s)}
              >
                <span className="text-lg leading-none">{s.native}</span>
                <span className="text-muted-foreground">:{s.id}:</span>
              </button>
            ))}
          </div>
        )}
        {/* Two equal bands (min 44px each): input / toolbar — divider at visual midpoint when empty */}
        <div className="grid min-h-[5.5rem] w-full min-w-0 grid-rows-[minmax(2.75rem,auto)_2.75rem]">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={isSending}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize();
              const cursor = e.target.selectionStart ?? e.target.value.length;
              syncColonState(e.target.value, cursor);
              syncMentionState(e.target.value, cursor);
              requestAnimationFrame(updateSelectionBar);
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              syncColonState(el.value, el.selectionStart ?? 0);
              syncMentionState(el.value, el.selectionStart ?? 0);
              updateSelectionBar();
            }}
            onKeyUp={updateSelectionBar}
            onMouseUp={updateSelectionBar}
            onBlur={() => setSelectionBar(null)}
            onContextMenu={() => setSelectionBar(null)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            aria-label={placeholder ?? defaultPlaceholder}
            placeholder={placeholder ?? defaultPlaceholder}
            rows={1}
            className={cn(
              'min-h-[2.75rem] min-w-0 max-h-[192px] w-full resize-none',
              'border-0 bg-transparent px-3 py-3 text-sm leading-5 text-foreground',
              'placeholder:text-muted-foreground focus:outline-none',
              isSending && 'cursor-wait opacity-70',
            )}
          />

          {/*
          Order: attach (+) first, then emoji → @ → voice → send.
          Bold: selection toolbar + ⌘/Ctrl+B only.
        */}
          <div
            role="toolbar"
            aria-label={t('composerToolbar')}
            className="flex h-11 min-h-[2.75rem] min-w-0 items-center gap-0 border-t border-border/50 px-1.5 sm:px-2"
          >
            <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-0">
              <DropdownMenu
                open={attachMenuOpen}
                onOpenChange={setAttachMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={toolbarIconButtonClass}
                    aria-label={t('attachMenu')}
                    title={t('attachMenu')}
                    disabled={isSending}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="min-w-[10rem] border border-border"
                >
                  <DropdownMenuItem
                    disabled={isSending}
                    className="gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() =>
                        imageInputRef.current?.click(),
                      );
                    }}
                  >
                    <Image className="h-4 w-4" aria-hidden />
                    {t('attachMenuPhoto')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isSending}
                    className="gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() =>
                        videoInputRef.current?.click(),
                      );
                    }}
                  >
                    <Video className="h-4 w-4" aria-hidden />
                    {t('attachMenuVideo')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isSending}
                    className="gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() =>
                        fileInputRef.current?.click(),
                      );
                    }}
                  >
                    <Paperclip className="h-4 w-4" aria-hidden />
                    {t('attachMenuFile')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <HumanChatPanelEmojiPicker
                open={emojiPickerOpen}
                onOpenChange={setEmojiPickerOpen}
                onEmojiSelect={insertEmoji}
                ariaLabel={t('emojiPickerComposer')}
                align="end"
              >
                <button
                  type="button"
                  className={toolbarIconButtonClass}
                  aria-label={t('emoji')}
                  title={t('emoji')}
                  aria-expanded={emojiPickerOpen}
                  disabled={isSending}
                  onPointerDownCapture={(e) => {
                    switchFromAttachMenu(e, () => setEmojiPickerOpen(true));
                  }}
                >
                  <Smile className="h-4 w-4" />
                </button>
              </HumanChatPanelEmojiPicker>
              <button
                type="button"
                className={toolbarIconButtonClass}
                aria-label={t('mention')}
                title={t('mention')}
                disabled={isSending}
                onPointerDownCapture={(e) =>
                  switchFromAttachMenu(e, handleMention)
                }
                onClick={() => onToolbarClickAfterAttachSwitch(handleMention)}
              >
                <AtSign className="h-4 w-4" />
              </button>
              {speechSupported && (
                <button
                  type="button"
                  className={cn(
                    toolbarIconButtonClass,
                    dictationActive && 'bg-accent-3 text-accent-11',
                  )}
                  aria-label={
                    dictationActive ? t('dictationStop') : t('dictationStart')
                  }
                  title={
                    dictationActive ? t('dictationStop') : t('dictationStart')
                  }
                  aria-pressed={dictationActive}
                  disabled={isSending}
                  onPointerDownCapture={(e) =>
                    switchFromAttachMenu(e, () =>
                      dictationActive ? stopDictation() : startDictation(),
                    )
                  }
                  onClick={() =>
                    onToolbarClickAfterAttachSwitch(() =>
                      dictationActive ? stopDictation() : startDictation(),
                    )
                  }
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!canSend) return;
                handleSendClick();
              }}
              disabled={!canSend}
              className={cn(
                toolbarIconButtonClass,
                'shrink-0',
                canSend
                  ? 'text-primary'
                  : 'cursor-not-allowed text-muted-foreground/40',
              )}
              aria-label={t('sendButton')}
              title={t('sendButton')}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CornerDownLeft className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
