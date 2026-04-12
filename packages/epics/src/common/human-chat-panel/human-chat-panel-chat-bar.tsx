'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Paperclip,
  ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  Code,
  TextQuote,
  Eye,
  EyeOff,
  Smile,
  AtSign,
  Send,
  X,
  Trash2,
  FileIcon,
  Play,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import {
  filterEmojiShortcodes,
  getActiveColonToken,
  loadEmojiSearchIndex,
  type EmojiIndexEntry,
} from './emoji-mart-index';
import { getTextareaSelectionCenter } from './textarea-caret-position';
import { looksLikeVideoMimeOrName } from './chat-panel-media-types';

type ReplyPreview = {
  authorLabel: string;
  excerpt: string;
  onDismiss: () => void;
};

export type ChatDraftAttachment = {
  id: string;
  file: File;
  kind: 'file' | 'image' | 'video';
  previewUrl: string;
  spoiler: boolean;
};

type HumanChatPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  channelName?: string;
  /** Rich reply: composer preview above the textarea */
  replyPreview?: ReplyPreview;
  draftAttachments?: ChatDraftAttachment[];
  onDraftAttachmentsChange?: (next: ChatDraftAttachment[]) => void;
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newAttachmentDraftId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ChatDraftVideoPreview({
  url,
  spoiler,
  playLabel,
  spoilerBadge,
}: {
  url: string;
  spoiler: boolean;
  playLabel: string;
  spoilerBadge: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    if (spoiler) {
      videoRef.current?.pause();
    }
  }, [spoiler]);

  return (
    <div className="relative h-full w-full bg-muted">
      <video
        ref={videoRef}
        src={url}
        className={cn(
          'h-full w-full object-contain',
          spoiler && 'scale-105 blur-xl',
        )}
        muted
        playsInline
        preload="auto"
        onLoadedData={() => {
          const el = videoRef.current;
          if (!el || hasFrame) return;
          try {
            if (el.readyState >= 2) {
              el.currentTime = 0.001;
            }
          } catch {
            // ignore seek errors on tiny clips
          }
          setHasFrame(true);
        }}
        onSeeked={() => setHasFrame(true)}
        onClick={() => {
          if (playing) videoRef.current?.pause();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {!hasFrame && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {spoiler && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-muted/90"
          aria-hidden
        >
          <span className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-background shadow-sm">
            {spoilerBadge}
          </span>
        </div>
      )}
      {!playing && !spoiler && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/20"
          aria-hidden
        >
          <button
            type="button"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/20 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={playLabel}
            title={playLabel}
            onClick={(e) => {
              e.stopPropagation();
              void videoRef.current?.play();
            }}
          >
            <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

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

export function HumanChatPanelChatBar({
  value,
  onChange,
  onSend,
  placeholder,
  channelName,
  replyPreview,
  draftAttachments = [],
  onDraftAttachmentsChange,
}: HumanChatPanelChatBarProps) {
  const t = useTranslations('HumanChatPanel');
  const fileInputId = useId();
  const imageInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  const replyPreviewWasOpenRef = useRef(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [colonOpen, setColonOpen] = useState(false);
  const [colonSuggestions, setColonSuggestions] = useState<EmojiIndexEntry[]>(
    [],
  );
  const [colonActive, setColonActive] = useState(0);
  const colonTokenRef = useRef<{ start: number; query: string } | null>(null);
  const colonRequestIdRef = useRef(0);

  const [selectionBar, setSelectionBar] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const updateSelectionBar = useCallback(() => {
    const el = textareaRef.current;
    if (!el || document.activeElement !== el) {
      setSelectionBar(null);
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end || colonOpen) {
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
  }, [colonOpen]);

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
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, []);

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

  useEffect(() => {
    if (colonOpen) setSelectionBar(null);
  }, [colonOpen]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim().length > 0 || draftAttachments.length > 0) {
        onSend();
      }
    }
  };

  const canSend = value.trim().length > 0 || draftAttachments.length > 0;

  const defaultPlaceholder = channelName
    ? t('placeholderChannel', { channel: channelName })
    : t('placeholder');

  const pushDrafts = useCallback(
    (files: FileList | File[], kind: 'file' | 'image') => {
      if (!onDraftAttachmentsChange) return;
      const arr = Array.from(files);
      const next: ChatDraftAttachment[] = [...draftAttachments];
      for (const file of arr) {
        if (kind === 'image' && !file.type.startsWith('image/')) {
          continue;
        }
        const isVideo =
          kind === 'file' && looksLikeVideoMimeOrName(file.type, file.name);
        const slotKind: ChatDraftAttachment['kind'] = file.type.startsWith(
          'image/',
        )
          ? 'image'
          : isVideo
          ? 'video'
          : 'file';
        next.push({
          id: newAttachmentDraftId(),
          file,
          kind: slotKind,
          previewUrl: URL.createObjectURL(file),
          spoiler: false,
        });
      }
      onDraftAttachmentsChange(next);
    },
    [draftAttachments, onDraftAttachmentsChange],
  );

  const removeDraft = useCallback(
    (id: string) => {
      if (!onDraftAttachmentsChange) return;
      const att = draftAttachments.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.previewUrl);
      onDraftAttachmentsChange(draftAttachments.filter((a) => a.id !== id));
    },
    [draftAttachments, onDraftAttachmentsChange],
  );

  const toggleDraftSpoiler = useCallback(
    (id: string) => {
      if (!onDraftAttachmentsChange) return;
      onDraftAttachmentsChange(
        draftAttachments.map((a) =>
          a.id === id ? { ...a, spoiler: !a.spoiler } : a,
        ),
      );
    },
    [draftAttachments, onDraftAttachmentsChange],
  );

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };
  const handleAttachImage = () => {
    imageInputRef.current?.click();
  };
  const handleBold = () => {};
  const handleMention = () => {};

  const iconButtonClass =
    'flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors';

  const fmtBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-popover-foreground transition-colors hover:bg-white/10';

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 p-3">
      <div
        ref={composerShellRef}
        className={cn(
          'relative flex min-w-0 flex-col rounded-2xl border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
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
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              pushDrafts(e.target.files, 'file');
            }
            e.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          id={imageInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              pushDrafts(e.target.files, 'image');
            }
            e.target.value = '';
          }}
        />

        {draftAttachments.length > 0 && (
          <div
            className="narrow-scrollbar max-h-[168px] shrink-0 overflow-x-auto overflow-y-hidden border-b border-border px-3 py-2"
            data-testid="chat-draft-attachments"
          >
            <div className="flex w-max flex-nowrap items-stretch gap-2 pb-1">
              {draftAttachments.map((att) => (
                <div
                  key={att.id}
                  className="relative flex w-[168px] shrink-0 flex-col gap-1 rounded-lg border border-border bg-muted/40 p-1.5"
                >
                  <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-md bg-background">
                    {att.kind === 'image' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                        <img
                          src={att.previewUrl}
                          alt=""
                          className={cn(
                            'h-full w-full object-cover',
                            att.spoiler && 'scale-105 blur-xl',
                          )}
                        />
                        {att.spoiler && (
                          <div
                            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/85"
                            aria-hidden
                          >
                            <span className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-background shadow-sm">
                              {t('draftSpoilerTag')}
                            </span>
                          </div>
                        )}
                      </>
                    ) : att.kind === 'video' ? (
                      <ChatDraftVideoPreview
                        url={att.previewUrl}
                        spoiler={att.spoiler}
                        playLabel={t('videoPreviewPlay')}
                        spoilerBadge={t('draftSpoilerTag')}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <FileIcon className="h-10 w-10" strokeWidth={1.25} />
                      </div>
                    )}
                    <div className="absolute right-1 top-1 z-30 flex gap-0.5 rounded-md bg-popover/95 p-0.5 shadow">
                      {(att.kind === 'image' || att.kind === 'video') && (
                        <button
                          type="button"
                          className="relative z-30 rounded p-1 text-foreground hover:bg-muted"
                          title={
                            att.spoiler
                              ? t('attachmentSpoilerRemove')
                              : t('attachmentSpoiler')
                          }
                          aria-label={
                            att.spoiler
                              ? t('attachmentSpoilerRemove')
                              : t('attachmentSpoiler')
                          }
                          aria-pressed={att.spoiler}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDraftSpoiler(att.id);
                          }}
                        >
                          {att.spoiler ? (
                            <EyeOff
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                              aria-hidden
                            />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="relative z-30 rounded p-1 text-destructive hover:bg-destructive/10"
                        title={t('attachmentRemove')}
                        aria-label={t('attachmentRemove')}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDraft(att.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="truncate px-0.5 text-xs text-muted-foreground">
                    {att.file.name}
                  </p>
                  <p className="px-0.5 text-[10px] text-muted-foreground/80">
                    {formatFileSize(att.file.size)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {replyPreview && (
          <div
            data-testid="chat-reply-preview"
            className="flex items-start gap-2 border-b border-border px-3 py-2"
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
              onClick={replyPreview.onDismiss}
            >
              <X className="h-4 w-4" />
            </button>
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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
            const cursor = e.target.selectionStart ?? e.target.value.length;
            syncColonState(e.target.value, cursor);
            requestAnimationFrame(updateSelectionBar);
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            syncColonState(el.value, el.selectionStart ?? 0);
            updateSelectionBar();
          }}
          onKeyUp={updateSelectionBar}
          onMouseUp={updateSelectionBar}
          onBlur={() => setSelectionBar(null)}
          onKeyDown={handleKeyDown}
          aria-label={placeholder ?? defaultPlaceholder}
          placeholder={placeholder ?? defaultPlaceholder}
          rows={1}
          className={cn(
            'min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
            'bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
        />

        <div className="flex min-w-0 items-center justify-between px-2 pb-2">
          {/* Left icons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('attachFile')}
              title={t('attachFile')}
              onClick={handleAttachFile}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('attachImage')}
              title={t('attachImage')}
              onClick={handleAttachImage}
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('bold')}
              title={t('bold')}
              onClick={handleBold}
            >
              <Bold className="h-4 w-4" />
            </button>
            <HumanChatPanelEmojiPicker
              open={emojiPickerOpen}
              onOpenChange={setEmojiPickerOpen}
              onEmojiSelect={insertEmoji}
              ariaLabel={t('emojiPickerComposer')}
              align="end"
            >
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('emoji')}
                title={t('emoji')}
                aria-expanded={emojiPickerOpen}
              >
                <Smile className="h-4 w-4" />
              </button>
            </HumanChatPanelEmojiPicker>
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('mention')}
              title={t('mention')}
              onClick={handleMention}
            >
              <AtSign className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-colors',
                canSend
                  ? 'text-primary hover:bg-primary/10'
                  : 'cursor-not-allowed text-muted-foreground/50',
              )}
              aria-label={t('sendButton')}
              title={t('sendButton')}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <span className="mt-1.5 px-1 text-xs text-muted-foreground">
        {t('newlineHint')}
      </span>
    </div>
  );
}
