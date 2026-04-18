'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
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
  Plus,
  ImageIcon,
  Paperclip,
  Video,
  Mic,
  AudioLines,
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
import { highlightComposerUrlsForBackdrop } from './human-chat-panel-composer-url-highlight';
import {
  type ChatPanelAttachmentMedia,
  looksLikeAudioMimeOrName,
  looksLikeVideoMimeOrName,
} from './chat-panel-media-types';
import { getActiveAtToken } from './human-chat-mention-token';
import {
  ChatVoiceAudioRow,
  useDraftVoiceDuration,
} from './human-chat-panel-voice-audio-row';
import { HumanChatMentionCandidateRow } from './human-chat-mention-candidate-row';

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

const ZWSP_CODE = 0x200b;

/** Linear-time strip (avoids ReDoS from `/\\u200b+$/` on user-controlled strings). */
function stripTrailingZeroWidthSpaces(s: string): string {
  let i = s.length;
  while (i > 0 && s.charCodeAt(i - 1) === ZWSP_CODE) {
    i -= 1;
  }
  return i === s.length ? s : s.slice(0, i);
}

/** Join two strings with a single space when both are non-empty and lack boundary whitespace. */
function joinWithSingleSpace(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  if (!left) return right;
  if (!right) return left;
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

type ReplyPreview = {
  authorLabel: string;
  excerpt: string;
  onDismiss: () => void;
};

type EditPreview = {
  excerpt: string;
  onDismiss: () => void;
};

/** Existing server slot when editing a media message (no new upload). */
export type ChatDraftEditSlot = {
  mxcUrl: string;
  msgtype: ChatPanelAttachmentMedia['msgtype'];
  filename?: string;
  mediaInfo?: ChatPanelAttachmentMedia['mediaInfo'];
  spoiler?: boolean;
};

/** Matrix room member for `@` autocomplete (MXID + display label). */
export type ChatMentionCandidate = {
  userId: string;
  displayLabel: string;
  /** Optional thumbnail for the mention picker (Matrix room avatar HTTP URL). */
  avatarUrl?: string;
  /** When known from space roster (`Person.sub`), resolves profile without Matrix→Privy lookup. */
  privySub?: string;
};

export type ChatDraftAttachment = {
  id: string;
  file: File;
  kind: 'file' | 'image' | 'video' | 'audio';
  previewUrl: string;
  spoiler: boolean;
  /** When set, this row is an existing Matrix attachment (edit mode). */
  editSlot?: ChatDraftEditSlot;
};

type HumanChatPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** Editing a media message: keep at least one attachment row. */
  editMediaMode?: boolean;
  placeholder?: string;
  channelName?: string;
  /** Rich reply: composer preview above the textarea */
  replyPreview?: ReplyPreview;
  /** Editing an existing own message (Matrix `m.replace`). */
  editPreview?: EditPreview;
  draftAttachments?: ChatDraftAttachment[];
  onDraftAttachmentsChange?: (next: ChatDraftAttachment[]) => void;
  /** Joined room members for `@` suggestions (omit when unavailable). */
  mentionCandidates?: ChatMentionCandidate[];
};

/** Blinking REC dot (“on-air”) for active voice recording / dictation controls. */
function ComposerRecOnAirIndicator() {
  return (
    <>
      <style>{`
        @keyframes hypha-rec-on-air {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.92); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hypha-rec-on-air] {
            animation: none !important;
          }
        }
      `}</style>
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        <span
          data-hypha-rec-on-air=""
          className="motion-safe:inline-block h-2.5 w-2.5 rounded-full bg-red-600 shadow-[0_0_0_1px_rgba(254,202,202,0.35)]"
          style={{
            animationName: 'hypha-rec-on-air',
            animationDuration: '1s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
          aria-hidden
        />
      </span>
    </>
  );
}

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

function DraftVoicePreview({
  previewUrl,
  voiceLabel,
  unknownDurationLabel,
  spoiler,
  spoilerBadgeLabel,
}: {
  previewUrl: string;
  voiceLabel: string;
  unknownDurationLabel: string;
  spoiler: boolean;
  spoilerBadgeLabel: string;
}) {
  const durationLabel = useDraftVoiceDuration({
    objectUrl: previewUrl,
    fallbackLabel: unknownDurationLabel,
  });
  return (
    <ChatVoiceAudioRow
      audioSrc={previewUrl}
      durationLabel={durationLabel}
      voiceLabel={voiceLabel}
      variant="draft"
      spoilerPreview={spoiler}
      spoilerBadgeLabel={spoilerBadgeLabel}
    />
  );
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
        onClick={(e) => {
          e.stopPropagation();
          const el = videoRef.current;
          if (!el || spoiler) return;
          if (playing) {
            el.pause();
          } else {
            void el.play().catch(() => {
              /* ignore — browser may block until user gesture; button retry */
            });
          }
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
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg ring-1 ring-white/20 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:ring-white/15"
            aria-label={playLabel}
            title={playLabel}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const el = videoRef.current;
              if (!el) return;
              el.muted = true;
              void el.play().catch(() => {});
            }}
          >
            <Play className="ml-1 h-6 w-6" fill="currentColor" aria-hidden />
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

const MAX_MENTION_SUGGESTIONS = 24;

function filterMentionCandidates(
  all: ChatMentionCandidate[],
  query: string,
): ChatMentionCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return all.slice(0, MAX_MENTION_SUGGESTIONS);
  }

  const starts: ChatMentionCandidate[] = [];
  const contains: ChatMentionCandidate[] = [];
  for (const m of all) {
    const label = m.displayLabel.toLowerCase();
    const id = m.userId.toLowerCase();
    const local = m.userId.startsWith('@')
      ? m.userId.slice(1).split(':')[0]?.toLowerCase() ?? ''
      : '';
    if (
      label.startsWith(q) ||
      id.startsWith(`@${q}`) ||
      id.startsWith(q) ||
      (local && local.startsWith(q))
    ) {
      starts.push(m);
    } else if (label.includes(q) || id.includes(q)) {
      contains.push(m);
    }
    if (starts.length + contains.length >= MAX_MENTION_SUGGESTIONS * 2) {
      break;
    }
  }
  return [...starts, ...contains].slice(0, MAX_MENTION_SUGGESTIONS);
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
  editMediaMode = false,
  placeholder,
  channelName,
  replyPreview,
  editPreview,
  draftAttachments = [],
  onDraftAttachmentsChange,
  mentionCandidates = [],
}: HumanChatPanelChatBarProps) {
  const t = useTranslations('HumanChatPanel');
  const fileInputId = useId();
  const imageInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** When true, `MediaRecorder` stop should add an audio draft; when false (dictation), discard blob. */
  const voiceAsAttachmentRef = useRef(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** Composer text before this dictation session (final + interim are appended live). */
  const dictationPrefixRef = useRef('');
  const [isDictating, setIsDictating] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Mirrored backdrop for Discord-style URL coloring (textarea text is transparent). */
  const composerBackdropRef = useRef<HTMLDivElement>(null);

  const composerHighlightBackdrop = useMemo(
    () => highlightComposerUrlsForBackdrop(value),
    [value],
  );
  const composerShellRef = useRef<HTMLDivElement>(null);
  const replyPreviewWasOpenRef = useRef(false);
  const editPreviewWasOpenRef = useRef(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [colonOpen, setColonOpen] = useState(false);
  const [colonSuggestions, setColonSuggestions] = useState<EmojiIndexEntry[]>(
    [],
  );
  const [colonActive, setColonActive] = useState(0);
  const colonTokenRef = useRef<{ start: number; query: string } | null>(null);
  const colonRequestIdRef = useRef(0);

  const [atOpen, setAtOpen] = useState(false);
  const [atSuggestions, setAtSuggestions] = useState<ChatMentionCandidate[]>(
    [],
  );
  const [atActive, setAtActive] = useState(0);
  const atTokenRef = useRef<ReturnType<typeof getActiveAtToken>>(null);

  const [selectionBar, setSelectionBar] = useState<{
    top: number;
    left: number;
  } | null>(null);
  /** While true, user is dragging a selection — hide format bar until pointerup. */
  const pointerSelectingRef = useRef(false);
  const [composerDragDepth, setComposerDragDepth] = useState(0);
  const isComposerDropActive = composerDragDepth > 0;

  const updateSelectionBar = useCallback(() => {
    const el = textareaRef.current;
    if (!el || document.activeElement !== el) {
      setSelectionBar(null);
      return;
    }
    if (pointerSelectingRef.current) {
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end || colonOpen || atOpen) {
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
  }, [colonOpen, atOpen]);

  useEffect(() => {
    const endPointerSelect = () => {
      if (!pointerSelectingRef.current) return;
      pointerSelectingRef.current = false;
      requestAnimationFrame(() => {
        updateSelectionBar();
      });
    };
    window.addEventListener('pointerup', endPointerSelect);
    window.addEventListener('pointercancel', endPointerSelect);
    return () => {
      window.removeEventListener('pointerup', endPointerSelect);
      window.removeEventListener('pointercancel', endPointerSelect);
    };
  }, [updateSelectionBar]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    const bd = composerBackdropRef.current;
    if (!ta) return;
    const content = valueRef.current;
    /**
     * After send we clear to `''`. With only `height='auto'`, some browsers keep the
     * previous large scrollHeight — force a shrink before measuring.
     */
    if (content.length === 0) {
      ta.style.height = '0px';
      void ta.offsetHeight;
    }
    ta.style.height = 'auto';
    const h = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${h}px`;
    if (content.length === 0) {
      ta.scrollTop = 0;
    }
    if (bd) {
      bd.style.height = `${h}px`;
      if (content.length === 0) {
        bd.scrollTop = 0;
      }
    }
  }, []);

  useEffect(() => {
    const isOpen = Boolean(replyPreview);
    if (isOpen) {
      if (!replyPreviewWasOpenRef.current) {
        textareaRef.current?.focus();
      }
      autoResize();
    }
    replyPreviewWasOpenRef.current = isOpen;
  }, [replyPreview, autoResize]);

  useEffect(() => {
    const isOpen = Boolean(editPreview);
    if (isOpen) {
      if (!editPreviewWasOpenRef.current) {
        textareaRef.current?.focus();
      }
      autoResize();
    }
    editPreviewWasOpenRef.current = isOpen;
  }, [editPreview, autoResize]);

  const syncColonState = useCallback((val: string, cursor: number) => {
    const requestId = ++colonRequestIdRef.current;
    if (getActiveAtToken(val, cursor)) {
      colonTokenRef.current = null;
      setColonOpen(false);
      setColonSuggestions([]);
      setColonActive(0);
      return;
    }
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

  const syncAtState = useCallback(
    (val: string, cursor: number) => {
      if (getActiveColonToken(val, cursor)) {
        atTokenRef.current = null;
        setAtOpen(false);
        setAtSuggestions([]);
        setAtActive(0);
        return;
      }
      const tok = getActiveAtToken(val, cursor);
      atTokenRef.current = tok;
      if (!tok) {
        setAtOpen(false);
        setAtSuggestions([]);
        setAtActive(0);
        return;
      }
      if (!mentionCandidates.length) {
        setAtOpen(false);
        setAtSuggestions([]);
        setAtActive(0);
        return;
      }
      const sug = filterMentionCandidates(mentionCandidates, tok.query);
      setAtSuggestions(sug);
      setAtActive(0);
      setAtOpen(sug.length > 0);
    },
    [mentionCandidates],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      setColonOpen(false);
      setColonSuggestions([]);
      colonTokenRef.current = null;
      setAtOpen(false);
      setAtSuggestions([]);
      atTokenRef.current = null;
      return;
    }
    syncColonState(value, el.selectionStart ?? value.length);
    syncAtState(value, el.selectionStart ?? value.length);
  }, [value, syncColonState, syncAtState]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    syncAtState(value, el.selectionStart ?? value.length);
  }, [mentionCandidates, value, syncAtState]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

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

  const applyAtChoice = useCallback(
    (member: ChatMentionCandidate) => {
      const el = textareaRef.current;
      const tok = atTokenRef.current;
      if (!el || !tok) return;
      const insertion = `${member.userId} `;
      const start = tok.start;
      const end = el.selectionStart ?? value.length;
      const { next, caret } = insertAtCaret(value, start, end, insertion);
      onChange(next);
      setAtOpen(false);
      setAtSuggestions([]);
      atTokenRef.current = null;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
        autoResize();
      });
    },
    [value, onChange, autoResize],
  );

  const openMentionPicker = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cur = el.selectionStart ?? value.length;
    const before = value.slice(0, cur);
    const after = value.slice(cur);
    const needsSpace =
      before.length > 0 && !/\s$/.test(before) && !before.endsWith('@');
    const prefix = needsSpace ? `${before} @` : `${before}@`;
    const next = prefix + after;
    const caret = prefix.length;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      autoResize();
      syncAtState(next, caret);
    });
  }, [value, onChange, autoResize, syncAtState]);

  useEffect(() => {
    if (colonOpen || atOpen) setSelectionBar(null);
  }, [colonOpen, atOpen]);

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

  const canSend =
    (value.trim().length > 0 || draftAttachments.length > 0) &&
    (!editMediaMode || draftAttachments.length > 0);

  const handleAttachMenuContentEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const ne = e.nativeEvent as KeyboardEvent;
      if (ne.isComposing && !(canSend && draftAttachments.length > 0)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setAttachMenuOpen(false);
      if (canSend) {
        onSend();
      }
    },
    [canSend, draftAttachments.length, onSend],
  );

  const focusComposerTextarea = useCallback(() => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = valueRef.current.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore
      }
      autoResize();
    });
  }, [autoResize]);

  const prevDraftCountRef = useRef(0);
  useEffect(() => {
    const n = draftAttachments.length;
    const prev = prevDraftCountRef.current;
    prevDraftCountRef.current = n;
    if (n > prev) {
      focusComposerTextarea();
    }
  }, [draftAttachments.length, focusComposerTextarea]);

  /**
   * Enter only bubbles to `textarea` when it is focused. After interacting with
   * draft cards (spoiler/delete), focus can stay in the attachment strip — still
   * send on Enter when there is something to send (e.g. voice-only).
   */
  const handleDraftAttachmentsKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const ne = e.nativeEvent as KeyboardEvent;
      if (ne.isComposing && !(canSend && draftAttachments.length > 0)) {
        return;
      }
      if (
        atOpen ||
        colonOpen ||
        colonSuggestions.length > 0 ||
        atSuggestions.length > 0
      )
        return;
      if (!canSend) return;
      e.preventDefault();
      onSend();
    },
    [
      atOpen,
      colonOpen,
      colonSuggestions.length,
      atSuggestions.length,
      canSend,
      draftAttachments.length,
      onSend,
    ],
  );

  /**
   * Enter often targets the attach (+) or mic trigger after menus/files — send from
   * anywhere in the composer shell unless a popover menu is open.
   */
  const handleComposerShellKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const ne = e.nativeEvent as KeyboardEvent;
      if (ne.isComposing && !(canSend && draftAttachments.length > 0)) {
        return;
      }
      if (
        atOpen ||
        colonOpen ||
        colonSuggestions.length > 0 ||
        atSuggestions.length > 0
      )
        return;
      if (attachMenuOpen || emojiPickerOpen) return;
      const el = e.target;
      if (el instanceof HTMLTextAreaElement) return;
      if (!canSend) return;
      e.preventDefault();
      onSend();
    },
    [
      atOpen,
      colonOpen,
      colonSuggestions.length,
      atSuggestions.length,
      attachMenuOpen,
      emojiPickerOpen,
      canSend,
      draftAttachments.length,
      onSend,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (atOpen && atSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAtActive((i) => (i + 1) % atSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAtActive(
          (i) => (i - 1 + atSuggestions.length) % atSuggestions.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const safeIndex = Math.max(
          0,
          Math.min(atActive, atSuggestions.length - 1),
        );
        const pick = atSuggestions[safeIndex];
        if (pick) applyAtChoice(pick);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAtOpen(false);
        setAtSuggestions([]);
        atTokenRef.current = null;
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

    if (e.key === 'Enter' && !e.shiftKey) {
      const composing = e.nativeEvent.isComposing;
      if (composing && !(canSend && draftAttachments.length > 0)) {
        return;
      }
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

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
        const isAudio =
          kind === 'file' && looksLikeAudioMimeOrName(file.type, file.name);
        const isVideo =
          kind === 'file' &&
          !isAudio &&
          looksLikeVideoMimeOrName(file.type, file.name);
        const slotKind: ChatDraftAttachment['kind'] = file.type.startsWith(
          'image/',
        )
          ? 'image'
          : isVideo
          ? 'video'
          : isAudio
          ? 'audio'
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
      if (att?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(att.previewUrl);
      }
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
  const handleAttachVideo = () => {
    videoInputRef.current?.click();
  };

  const stopVoiceRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') {
      setIsVoiceRecording(false);
      return;
    }
    try {
      mr.stop();
    } catch {
      // ignore
    }
    setIsVoiceRecording(false);
  }, []);

  const startVoiceRecordingAsAttachment = useCallback(async () => {
    if (!onDraftAttachmentsChange) return;
    if (isVoiceRecording) {
      stopVoiceRecording();
      return;
    }
    if (
      typeof globalThis.MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setVoiceError(t('voiceRecordingNotSupported'));
      return;
    }
    setVoiceError(null);
    voiceAsAttachmentRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      /** One array per recorder so rapid stop/start cannot mix async `ondataavailable` chunks. */
      const chunks: BlobPart[] = [];
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const mimeType = preferredTypes.find(
        (mt) =>
          typeof MediaRecorder !== 'undefined' &&
          MediaRecorder.isTypeSupported(mt),
      );
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };
      mr.onstop = () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const asAttach = voiceAsAttachmentRef.current;
        voiceAsAttachmentRef.current = false;
        if (!asAttach || blob.size < 256) {
          return;
        }
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
        const name = `voice-message-${Date.now()}.${ext}`;
        const file = new File([blob], name, {
          type: blob.type || 'audio/webm',
        });
        pushDrafts([file], 'file');
      };
      mr.start();
      setIsVoiceRecording(true);
      focusComposerTextarea();
    } catch {
      voiceAsAttachmentRef.current = false;
      const s = mediaStreamRef.current;
      if (s) {
        for (const track of s.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      setVoiceError(t('voiceMicPermissionDenied'));
      setIsVoiceRecording(false);
    }
  }, [
    isVoiceRecording,
    onDraftAttachmentsChange,
    pushDrafts,
    stopVoiceRecording,
    focusComposerTextarea,
    t,
  ]);

  const stopDictation = useCallback(() => {
    const r = speechRecognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        try {
          r.abort();
        } catch {
          // ignore
        }
      }
      speechRecognitionRef.current = null;
    }
    setIsDictating(false);
  }, []);

  const startDictation = useCallback(() => {
    setVoiceError(null);
    const SR =
      (globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (
        globalThis as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError(t('dictationNotSupported'));
      return;
    }
    if (isDictating) {
      stopDictation();
      return;
    }
    dictationPrefixRef.current = stripTrailingZeroWidthSpaces(valueRef.current);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = document.documentElement.lang || 'en';
    rec.onresult = (ev) => {
      const results = ev.results;
      const committedParts: string[] = [];
      let interimAccum = '';
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (!res?.[0]) continue;
        const t = res[0].transcript;
        if (res.isFinal) {
          const piece = t.trim();
          if (piece) committedParts.push(piece);
        } else {
          interimAccum = joinWithSingleSpace(interimAccum, t);
        }
      }
      const committedStr = committedParts.join(' ');
      const interimStr = interimAccum.trim();
      const dictated = joinWithSingleSpace(committedStr, interimStr);
      const next = joinWithSingleSpace(dictationPrefixRef.current, dictated);
      valueRef.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el || document.activeElement !== el) return;
        const end = valueRef.current.length;
        el.setSelectionRange(end, end);
      });
    };
    rec.onerror = () => {
      speechRecognitionRef.current = null;
      dictationPrefixRef.current = '';
      setIsDictating(false);
      onChange(stripTrailingZeroWidthSpaces(valueRef.current));
      setVoiceError(t('dictationError'));
    };
    rec.onend = () => {
      speechRecognitionRef.current = null;
      dictationPrefixRef.current = '';
      setIsDictating(false);
      onChange(stripTrailingZeroWidthSpaces(valueRef.current));
    };
    speechRecognitionRef.current = rec;
    try {
      rec.start();
      setIsDictating(true);
      focusComposerTextarea();
    } catch {
      speechRecognitionRef.current = null;
      setVoiceError(t('dictationNotSupported'));
    }
  }, [isDictating, onChange, stopDictation, focusComposerTextarea, t]);

  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === 'recording') {
        try {
          mr.stop();
        } catch {
          // ignore
        }
      }
      const s = mediaStreamRef.current;
      if (s) {
        for (const track of s.getTracks()) {
          track.stop();
        }
      }
      const r = speechRecognitionRef.current;
      if (r) {
        try {
          r.abort();
        } catch {
          // ignore
        }
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  const iconButtonClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-primary/12 hover:text-primary active:bg-primary/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0';

  const fmtBtn =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground';

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 px-3 pt-3 pb-3">
      <div
        ref={composerShellRef}
        onKeyDownCapture={handleComposerShellKeyDownCapture}
        className={cn(
          'relative flex min-w-0 flex-col rounded-lg border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
          isComposerDropActive && 'border-primary/50 ring-2 ring-primary/25',
        )}
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) {
            return;
          }
          e.preventDefault();
          if (!onDraftAttachmentsChange) {
            return;
          }
          if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
          }
          setComposerDragDepth((d) => d + 1);
        }}
        onDragLeave={(e) => {
          if (!onDraftAttachmentsChange) return;
          if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
          }
          setComposerDragDepth((d) => Math.max(0, d - 1));
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) {
            return;
          }
          e.preventDefault();
          if (!onDraftAttachmentsChange) {
            return;
          }
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) {
            return;
          }
          e.preventDefault();
          setComposerDragDepth(0);
          if (!onDraftAttachmentsChange) {
            return;
          }
          const files = e.dataTransfer?.files;
          if (!files?.length) return;
          pushDrafts(files, 'file');
        }}
      >
        {isComposerDropActive && (
          <div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-background/75 backdrop-blur-[2px]"
            aria-hidden
          >
            <p className="rounded-md border border-primary/40 bg-popover/95 px-3 py-2 text-sm font-medium text-foreground shadow-sm">
              {t('composerDropPrompt')}
            </p>
          </div>
        )}
        {selectionBar && (
          <div
            className="absolute z-30 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0"
            style={{
              left: selectionBar.left,
              /* Bottom of this stack sits here; subtract gap so arrow tip clears selected text */
              top: Math.max(4, selectionBar.top - 4),
            }}
          >
            <div
              role="toolbar"
              aria-label={t('formatSelectionBar')}
              className="flex items-center gap-0 rounded-md border border-border bg-popover px-0.5 py-0.5 text-popover-foreground shadow-md"
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className={fmtBtn}
                title={t('bold')}
                aria-label={t('bold')}
                onClick={() => applyFormat('bold')}
              >
                <Bold className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('italic')}
                aria-label={t('italic')}
                onClick={() => applyFormat('italic')}
              >
                <Italic className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('strikethrough')}
                aria-label={t('strikethrough')}
                onClick={() => applyFormat('strike')}
              >
                <Strikethrough className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('blockquote')}
                aria-label={t('blockquote')}
                onClick={() => applyFormat('blockquote')}
              >
                <TextQuote className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('inlineCode')}
                aria-label={t('inlineCode')}
                onClick={() => applyFormat('code')}
              >
                <Code className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={fmtBtn}
                title={t('spoiler')}
                aria-label={t('spoiler')}
                onClick={() => applyFormat('spoiler')}
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            <div
              className="pointer-events-none flex justify-center"
              aria-hidden
            >
              <div className="h-0 w-0 border-x-[5px] border-b-[6px] border-x-transparent border-b-popover" />
            </div>
          </div>
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
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
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

        {draftAttachments.length > 0 && (
          <div
            onKeyDownCapture={handleDraftAttachmentsKeyDownCapture}
            className="narrow-scrollbar max-h-[168px] shrink-0 overflow-x-auto overflow-y-hidden border-b border-border px-3 py-2"
            data-testid="chat-draft-attachments"
          >
            <div className="flex w-max flex-nowrap items-stretch gap-2 pb-1">
              {draftAttachments.map((att) => (
                <div
                  key={att.id}
                  className={cn(
                    'relative flex shrink-0 flex-col gap-1 rounded-lg border border-border bg-muted/40 p-1.5',
                    att.kind === 'audio' ? 'w-[220px]' : 'w-[168px]',
                  )}
                >
                  <div
                    className={cn(
                      'relative w-full shrink-0 overflow-hidden rounded-md bg-background',
                      att.kind === 'audio' ? 'min-h-[52px]' : 'h-24',
                    )}
                  >
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
                    ) : att.kind === 'audio' ? (
                      <div className="flex h-full min-h-[52px] items-center px-1 py-1">
                        <DraftVoicePreview
                          previewUrl={att.previewUrl}
                          voiceLabel={t('voiceMessage')}
                          unknownDurationLabel="0:00"
                          spoiler={att.spoiler}
                          spoilerBadgeLabel={t('draftSpoilerTag')}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <FileIcon className="h-10 w-10" strokeWidth={1.25} />
                      </div>
                    )}
                    <div className="absolute right-1 top-1 z-30 flex gap-0.5 rounded-md bg-popover/95 p-0.5 shadow">
                      {(att.kind === 'image' ||
                        att.kind === 'video' ||
                        att.kind === 'audio') && (
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
                        disabled={editMediaMode && draftAttachments.length <= 1}
                        className="relative z-30 rounded p-1 text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
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
                    {att.editSlot?.filename ?? att.file.name}
                  </p>
                  <p className="px-0.5 text-[10px] text-muted-foreground/80">
                    {formatFileSize(
                      att.editSlot?.mediaInfo?.size ?? att.file.size,
                    )}
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
        {editPreview && (
          <div
            data-testid="chat-edit-preview"
            className="flex items-start gap-2 border-b border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('editingMessage')}
                </span>
                <span className="text-muted-foreground"> — </span>
                <span>{editPreview.excerpt}</span>
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('editDismiss')}
              title={t('editDismiss')}
              onClick={editPreview.onDismiss}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {atOpen && atSuggestions.length > 0 && (
          <div
            role="listbox"
            aria-label={t('mentionListLabel')}
            className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-52 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {atSuggestions.map((m, idx) => (
              <HumanChatMentionCandidateRow
                key={m.userId}
                matrixUserId={m.userId}
                matrixFallbackLabel={m.displayLabel}
                matrixFallbackAvatarUrl={m.avatarUrl}
                privySub={m.privySub}
                isActive={idx === atActive}
                onPick={() => applyAtChoice(m)}
              />
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
        <div className="relative isolate grid min-h-[36px] min-w-0 max-h-[160px] w-full [&>textarea]:col-start-1 [&>textarea]:row-start-1 [&>textarea]:col-end-2 [&>textarea]:row-end-2">
          <div
            ref={composerBackdropRef}
            aria-hidden
            className={cn(
              'pointer-events-none col-start-1 row-start-1 min-h-[36px] max-h-[160px] w-full',
              'overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-relaxed text-foreground',
              'selection:bg-transparent narrow-scrollbar',
            )}
          >
            {composerHighlightBackdrop}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onScroll={(e) => {
              const bd = composerBackdropRef.current;
              if (bd) bd.scrollTop = e.currentTarget.scrollTop;
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              pointerSelectingRef.current = true;
              setSelectionBar(null);
            }}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize();
              const cursor = e.target.selectionStart ?? e.target.value.length;
              syncColonState(e.target.value, cursor);
              syncAtState(e.target.value, cursor);
              requestAnimationFrame(updateSelectionBar);
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              syncColonState(el.value, el.selectionStart ?? 0);
              syncAtState(el.value, el.selectionStart ?? 0);
            }}
            onKeyUp={updateSelectionBar}
            onMouseUp={updateSelectionBar}
            onBlur={() => setSelectionBar(null)}
            onKeyDown={handleKeyDown}
            aria-label={placeholder ?? defaultPlaceholder}
            placeholder={placeholder ?? defaultPlaceholder}
            rows={1}
            className={cn(
              'relative z-[1] col-start-1 row-start-1 min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
              'overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-3 py-2.5 text-sm leading-relaxed',
              'text-transparent caret-foreground',
              'placeholder:text-muted-foreground focus:outline-none',
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1 px-2 pb-2.5 pt-0">
          {voiceError && (
            <p role="alert" className="text-xs text-destructive">
              {voiceError}
            </p>
          )}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <DropdownMenu
                modal={false}
                open={attachMenuOpen}
                onOpenChange={setAttachMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={iconButtonClass}
                    aria-label={t('composerAttachMenu')}
                    title={t('composerAttachMenu')}
                    aria-expanded={attachMenuOpen}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="min-w-[200px]"
                  onKeyDownCapture={handleAttachMenuContentEnter}
                >
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() => handleAttachImage());
                    }}
                  >
                    <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t('composerAttachImage')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() => handleAttachVideo());
                    }}
                  >
                    <Video className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t('composerAttachVideo')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => {
                      requestAnimationFrame(() => handleAttachFile());
                    }}
                  >
                    <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t('composerAttachFile')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <HumanChatPanelEmojiPicker
                modal={false}
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
                disabled={mentionCandidates.length === 0}
                className={cn(
                  iconButtonClass,
                  mentionCandidates.length === 0 &&
                    'cursor-not-allowed opacity-50',
                )}
                aria-label={t('mention')}
                title={
                  mentionCandidates.length === 0
                    ? t('mentionNoMembers')
                    : t('mention')
                }
                onClick={() => openMentionPicker()}
              >
                <AtSign className="h-4 w-4" aria-hidden />
              </button>
              {/* Order: audio message (waves) left, dictate (mic) right; stop replaces the slot used */}
              {isVoiceRecording ? (
                <button
                  type="button"
                  className={cn(
                    iconButtonClass,
                    'rounded-sm border-2 border-red-500/85 bg-red-950/25 text-red-600 shadow-sm',
                    'hover:border-red-400 hover:bg-red-950/35 active:bg-red-950/45 dark:border-red-500 dark:bg-red-950/40',
                  )}
                  aria-label={t('composerStopRecording')}
                  title={t('composerStopRecording')}
                  onClick={() => stopVoiceRecording()}
                >
                  <ComposerRecOnAirIndicator />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDictating || !onDraftAttachmentsChange}
                  className={cn(
                    iconButtonClass,
                    (!onDraftAttachmentsChange || isDictating) &&
                      'cursor-not-allowed opacity-50',
                  )}
                  aria-label={t('composerSendAudioMessage')}
                  title={t('composerSendAudioMessage')}
                  onClick={() =>
                    requestAnimationFrame(
                      () => void startVoiceRecordingAsAttachment(),
                    )
                  }
                >
                  <AudioLines className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              )}
              {isDictating ? (
                <button
                  type="button"
                  className={cn(
                    iconButtonClass,
                    'rounded-sm border-2 border-red-500/85 bg-red-950/25 text-red-600 shadow-sm',
                    'hover:border-red-400 hover:bg-red-950/35 active:bg-red-950/45 dark:border-red-500 dark:bg-red-950/40',
                  )}
                  aria-label={t('composerStopDictation')}
                  title={t('composerStopDictation')}
                  onClick={() => stopDictation()}
                >
                  <ComposerRecOnAirIndicator />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isVoiceRecording}
                  className={cn(
                    iconButtonClass,
                    isVoiceRecording && 'cursor-not-allowed opacity-50',
                  )}
                  aria-label={t('composerDictateMessage')}
                  title={t('composerDictateMessage')}
                  onClick={() => requestAnimationFrame(() => startDictation())}
                >
                  <Mic className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0',
                canSend
                  ? 'text-primary hover:bg-primary/12 hover:text-primary active:bg-primary/18'
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
    </div>
  );
}
