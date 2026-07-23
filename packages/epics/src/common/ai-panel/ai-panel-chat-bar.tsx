'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  FileIcon,
  Eye,
  EyeOff,
  Loader2,
  ImageIcon,
  Mic,
  Paperclip,
  Play,
  Plus,
  Send,
  Square,
  Video,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_SIZE_LABEL,
} from '@hypha-platform/core/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useIsMobile,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { type ChatDraftAttachment } from '../human-chat-panel/human-chat-panel-chat-bar';
import {
  looksLikeAudioMimeOrName,
  looksLikeVideoMimeOrName,
} from '../human-chat-panel/chat-panel-media-types';
import {
  ChatVoiceAudioRow,
  useDraftVoiceDuration,
} from '../human-chat-panel/human-chat-panel-voice-audio-row';
import {
  ComposerAttachGoogleDriveMenuItem,
  filesToFileList,
} from '../composer';

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

export type AiPanelDraftAttachment = ChatDraftAttachment;

function joinWithSingleSpace(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  if (!left) return right;
  if (!right) return left;
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

/** Blinking REC dot (“on-air”) for active dictation control. */
function ComposerRecOnAirIndicator() {
  return (
    <>
      <style>{`
        @keyframes hypha-rec-on-air {
          0%, 100% { opacity: 1; transform: scale(1); filter: brightness(1); }
          50% { opacity: 0.88; transform: scale(0.94); filter: brightness(1.08); }
        }
        @keyframes hypha-rec-halo {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.35); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hypha-rec-on-air], [data-hypha-rec-halo] {
            animation: none !important;
          }
        }
      `}</style>
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        <span
          data-hypha-rec-halo=""
          className="pointer-events-none absolute h-3 w-3 rounded-full bg-red-500/35 blur-[2px]"
          style={{
            animationName: 'hypha-rec-halo',
            animationDuration: '1.2s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
          aria-hidden
        />
        <span
          data-hypha-rec-on-air=""
          className="motion-safe:relative inline-block h-2 w-2 rounded-full bg-error-9 ring-1 ring-error-11/40 dark:ring-error-8/50"
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

type AiPanelChatBarVariant = 'panel' | 'hero';

type AiPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  draftAttachments?: AiPanelDraftAttachment[];
  onDraftAttachmentsChange?: (files: AiPanelDraftAttachment[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  composerDisabled?: boolean;
  /** `hero` matches onboarding landing composer styling; default `panel` for sidebars. */
  variant?: AiPanelChatBarVariant;
  sendAriaLabel?: string;
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
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
              // ignore — browser may block until user gesture; button retry
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

export function AiPanelChatBar({
  value,
  onChange,
  onSend,
  draftAttachments = [],
  onDraftAttachmentsChange,
  onStop,
  isStreaming = false,
  placeholder,
  composerDisabled = false,
  variant = 'panel',
  sendAriaLabel,
}: AiPanelChatBarProps) {
  const isHero = variant === 'hero';
  const t = useTranslations('AiPanel');
  const tHuman = useTranslations('HumanChatPanel');
  const fileInputId = useId();
  const imageInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationPrefixRef = useRef('');
  const dictationInterruptForSendRef = useRef(false);
  const dictationSessionFinalizedRef = useRef(false);
  const valueRef = useRef(value);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const isMobile = useIsMobile() ?? false;
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [composerDragDepth, setComposerDragDepth] = useState(0);
  const isComposerDropActive = composerDragDepth > 0;

  valueRef.current = value;

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, []);

  useEffect(() => {
    if (isHero) return;
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      // Always collapse to single-line composer when cleared/reopened.
      el.style.height = '36px';
      return;
    }
    autoResize();
  }, [isHero, value, autoResize]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (
        (value.trim().length > 0 || draftAttachments.length > 0) &&
        !isStreaming
      ) {
        if (isDictating) {
          dictationInterruptForSendRef.current = true;
          const r = speechRecognitionRef.current;
          if (r) {
            try {
              r.abort();
            } catch {
              try {
                r.stop();
              } catch {
                // ignore
              }
            }
            speechRecognitionRef.current = null;
          }
          setIsDictating(false);
        }
        onSend();
      }
    }
  };

  const stopDictation = useCallback(() => {
    const r = speechRecognitionRef.current;
    if (r) {
      try {
        r.abort();
      } catch {
        try {
          r.stop();
        } catch {
          // ignore
        }
      }
      speechRecognitionRef.current = null;
    }
    dictationPrefixRef.current = '';
    setIsDictating(false);
  }, []);

  const startDictation = useCallback(() => {
    setDictationError(null);
    const SR =
      (globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (
        globalThis as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).webkitSpeechRecognition;
    if (!SR) {
      setDictationError(tHuman('dictationNotSupported'));
      return;
    }
    if (isDictating) {
      stopDictation();
      return;
    }

    dictationInterruptForSendRef.current = false;
    dictationSessionFinalizedRef.current = false;
    dictationPrefixRef.current = valueRef.current.trimEnd();
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = document.documentElement.lang || 'en';
    rec.onresult = (ev) => {
      if (dictationInterruptForSendRef.current) return;
      let committed = '';
      let interim = '';
      for (let i = 0; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (!res?.[0]) continue;
        const transcript = res[0].transcript;
        if (res.isFinal) {
          committed = joinWithSingleSpace(committed, transcript.trim());
        } else {
          interim = joinWithSingleSpace(interim, transcript);
        }
      }
      const dictated = joinWithSingleSpace(committed, interim.trim());
      const next = joinWithSingleSpace(dictationPrefixRef.current, dictated);
      valueRef.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const end = valueRef.current.length;
        el.setSelectionRange(end, end);
      });
    };

    const finalizeDictationFromBrowser = (opts: {
      syncValue: boolean;
      showError: boolean;
    }) => {
      if (dictationSessionFinalizedRef.current) return;
      dictationSessionFinalizedRef.current = true;
      speechRecognitionRef.current = null;
      dictationPrefixRef.current = '';
      setIsDictating(false);
      if (opts.syncValue) {
        onChange(valueRef.current.trimEnd());
      }
      if (opts.showError) {
        setDictationError(tHuman('dictationError'));
      }
    };

    rec.onerror = (ev) => {
      const interrupted = dictationInterruptForSendRef.current;
      if (interrupted) {
        dictationInterruptForSendRef.current = false;
      }
      const errorCode =
        typeof ev === 'object' && ev !== null && 'error' in ev
          ? (ev as { error?: string }).error
          : undefined;
      const benignError = errorCode === 'aborted';
      finalizeDictationFromBrowser({
        syncValue: !interrupted,
        showError: !interrupted && !benignError,
      });
    };
    rec.onend = () => {
      const interrupted = dictationInterruptForSendRef.current;
      if (interrupted) {
        dictationInterruptForSendRef.current = false;
      }
      finalizeDictationFromBrowser({
        syncValue: !interrupted,
        showError: false,
      });
    };

    speechRecognitionRef.current = rec;
    try {
      rec.start();
      setIsDictating(true);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      speechRecognitionRef.current = null;
      setDictationError(tHuman('dictationNotSupported'));
    }
  }, [isDictating, onChange, stopDictation, tHuman]);

  useEffect(() => {
    return () => {
      const r = speechRecognitionRef.current;
      if (!r) return;
      try {
        r.abort();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    };
  }, []);

  const canStop = isStreaming && typeof onStop === 'function';
  const canAttachDrafts =
    !composerDisabled && typeof onDraftAttachmentsChange === 'function';
  const pushDrafts = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || !onDraftAttachmentsChange) return;
      const next = [...draftAttachments];
      let rejected = false;
      for (const file of Array.from(files)) {
        if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
          rejected = true;
          continue;
        }
        const isAudio = looksLikeAudioMimeOrName(file.type, file.name);
        const isVideo =
          !isAudio && looksLikeVideoMimeOrName(file.type, file.name);
        const kind: AiPanelDraftAttachment['kind'] = file.type.startsWith(
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
          kind,
          previewUrl: URL.createObjectURL(file),
          spoiler: false,
        });
      }
      if (rejected) {
        setAttachError(
          tHuman('composerAttachmentTooLarge', {
            maxSize: CHAT_ATTACHMENT_MAX_SIZE_LABEL,
          }),
        );
      } else {
        setAttachError(null);
      }
      onDraftAttachmentsChange(next);
    },
    [draftAttachments, onDraftAttachmentsChange, tHuman],
  );
  const canSendWithAttachments =
    (value.trim().length > 0 || draftAttachments.length > 0) && !isStreaming;
  const recordingStopButtonClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-600 transition-all duration-200 ease-out ' +
    'border border-red-500/25 bg-gradient-to-b from-red-500/[0.14] via-red-500/[0.08] to-red-950/[0.06] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_3px_rgba(220,38,38,0.14)] ' +
    'hover:border-red-500/40 hover:from-red-500/[0.2] hover:via-red-500/[0.12] hover:to-red-950/[0.1] hover:text-red-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(220,38,38,0.18)] ' +
    'active:scale-[0.96] active:from-red-500/[0.24] active:via-red-600/[0.14] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'dark:border-red-400/22 dark:from-red-500/[0.16] dark:via-red-600/[0.1] dark:to-red-950/40 dark:text-red-400 ' +
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_4px_rgba(0,0,0,0.35)] ' +
    'dark:hover:border-red-400/38 dark:hover:text-red-300';
  const sendMessage = useCallback(() => {
    if (isDictating) {
      dictationInterruptForSendRef.current = true;
      const r = speechRecognitionRef.current;
      if (r) {
        try {
          r.abort();
        } catch {
          try {
            r.stop();
          } catch {
            // ignore
          }
        }
        speechRecognitionRef.current = null;
      }
      setIsDictating(false);
    }
    onSend();
  }, [isDictating, onSend]);

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };
  const handleAttachImage = () => {
    imageInputRef.current?.click();
  };
  const handleAttachVideo = () => {
    videoInputRef.current?.click();
  };

  const iconButtonClass = isHero
    ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
    : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-primary/12 hover:text-primary active:bg-primary/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0';
  const heroSendButtonClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-accent-9 p-0 text-white shadow-[0_8px_20px_-8px_var(--color-accent-9)] transition-all hover:bg-accent-10 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 [.dark_&]:bg-info-9 [.dark_&]:shadow-[0_8px_20px_-8px_var(--color-info-9)] [.dark_&]:hover:bg-info-10';

  useEffect(() => {
    if (!canAttachDrafts && attachMenuOpen) {
      setAttachMenuOpen(false);
    }
  }, [attachMenuOpen, canAttachDrafts]);

  const removeDraftAttachment = useCallback(
    (index: number) => {
      if (!onDraftAttachmentsChange) return;
      const target = draftAttachments[index];
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      onDraftAttachmentsChange(draftAttachments.filter((_, i) => i !== index));
    },
    [draftAttachments, onDraftAttachmentsChange],
  );

  const toggleDraftSpoiler = useCallback(
    (id: string) => {
      if (!onDraftAttachmentsChange) return;
      onDraftAttachmentsChange(
        draftAttachments.map((att) =>
          att.id === id ? { ...att, spoiler: !att.spoiler } : att,
        ),
      );
    },
    [draftAttachments, onDraftAttachmentsChange],
  );

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-shrink-0 flex-col bg-transparent',
        !isHero && 'px-3 pb-3 pt-3',
      )}
    >
      <div
        className={cn(
          'relative flex min-w-0 flex-col',
          !isHero &&
            cn(
              'rounded-lg border border-border bg-muted/50',
              'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
              isComposerDropActive &&
                'border-primary/50 ring-2 ring-primary/25',
            ),
        )}
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          if (!canAttachDrafts) return;
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setComposerDragDepth((d) => d + 1);
        }}
        onDragLeave={(e) => {
          if (!canAttachDrafts) return;
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setComposerDragDepth((d) => Math.max(0, d - 1));
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          if (!canAttachDrafts) return;
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          setComposerDragDepth(0);
          if (!canAttachDrafts) return;
          pushDrafts(e.dataTransfer.files);
        }}
      >
        {isComposerDropActive && (
          <div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-background/75 backdrop-blur-[2px]"
            aria-hidden
          >
            <p className="rounded-md border border-primary/40 bg-popover/95 px-3 py-2 text-sm font-medium text-foreground shadow-sm">
              {tHuman('composerDropPrompt')}
            </p>
          </div>
        )}
        {draftAttachments.length > 0 && (
          <div
            className={cn(
              'narrow-scrollbar shrink-0 overflow-x-auto overflow-y-hidden border-b px-3 py-2',
              isHero
                ? 'max-h-[168px] border-border/65'
                : 'max-h-[168px] border-border',
            )}
          >
            <div className="flex w-max flex-nowrap items-stretch gap-2 pb-1">
              {draftAttachments.map((att, index) => (
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
                              {tHuman('draftSpoilerTag')}
                            </span>
                          </div>
                        )}
                      </>
                    ) : att.kind === 'video' ? (
                      <ChatDraftVideoPreview
                        url={att.previewUrl}
                        spoiler={att.spoiler}
                        playLabel={tHuman('videoPreviewPlay')}
                        spoilerBadge={tHuman('draftSpoilerTag')}
                      />
                    ) : att.kind === 'audio' ? (
                      <div className="flex h-full min-h-[52px] items-center px-1 py-1">
                        <DraftVoicePreview
                          previewUrl={att.previewUrl}
                          voiceLabel={tHuman('voiceMessage')}
                          unknownDurationLabel="0:00"
                          spoiler={att.spoiler}
                          spoilerBadgeLabel={tHuman('draftSpoilerTag')}
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
                              ? tHuman('attachmentSpoilerRemove')
                              : tHuman('attachmentSpoiler')
                          }
                          aria-label={
                            att.spoiler
                              ? tHuman('attachmentSpoilerRemove')
                              : tHuman('attachmentSpoiler')
                          }
                          aria-pressed={att.spoiler}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDraftSpoiler(att.id);
                          }}
                        >
                          {att.spoiler ? (
                            <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="relative z-30 rounded p-1 text-destructive hover:bg-destructive/10"
                        title={tHuman('attachmentRemove')}
                        aria-label={tHuman('attachmentRemove')}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDraftAttachment(index);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
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
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={isDictating || composerDisabled}
          disabled={composerDisabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isHero) autoResize();
          }}
          onKeyDown={handleKeyDown}
          aria-label={placeholder ?? t('placeholder')}
          placeholder={placeholder ?? t('placeholder')}
          rows={isHero ? 3 : 1}
          className={cn(
            'min-w-0 w-full resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:outline-none',
            isHero
              ? 'relative min-h-[120px] overflow-y-auto px-4 py-3 text-3'
              : 'min-h-[36px] max-h-[160px] px-3 py-2.5 text-sm leading-relaxed',
          )}
          style={isHero ? undefined : { minHeight: '36px', maxHeight: '160px' }}
        />
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          onChange={(e) => {
            pushDrafts(e.target.files);
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
            pushDrafts(e.target.files);
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
            pushDrafts(e.target.files);
            e.target.value = '';
          }}
        />

        <div
          className={cn(
            'flex min-w-0 flex-col gap-1 pt-0',
            isHero ? 'px-3 pb-2.5' : 'px-2 pb-2.5',
          )}
        >
          {(dictationError || attachError) && (
            <p role="alert" className="px-1 text-xs text-destructive">
              {dictationError ?? attachError}
            </p>
          )}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              {canAttachDrafts ? (
                <DropdownMenu
                  modal={isMobile}
                  open={attachMenuOpen}
                  onOpenChange={(open) => {
                    if (!canAttachDrafts) return;
                    setAttachMenuOpen(open);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={iconButtonClass}
                      aria-label={tHuman('composerAttachMenu')}
                      title={tHuman('composerAttachMenu')}
                      aria-expanded={attachMenuOpen}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side={isMobile ? 'top' : 'bottom'}
                    collisionPadding={8}
                    className="z-[100] min-w-[200px]"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onSelect={() => {
                        if (!canAttachDrafts) return;
                        requestAnimationFrame(() => handleAttachImage());
                      }}
                    >
                      <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{tHuman('composerAttachImage')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onSelect={() => {
                        if (!canAttachDrafts) return;
                        requestAnimationFrame(() => handleAttachVideo());
                      }}
                    >
                      <Video className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{tHuman('composerAttachVideo')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onSelect={() => {
                        if (!canAttachDrafts) return;
                        requestAnimationFrame(() => handleAttachFile());
                      }}
                    >
                      <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{tHuman('composerAttachFile')}</span>
                    </DropdownMenuItem>
                    <ComposerAttachGoogleDriveMenuItem
                      disabled={!canAttachDrafts}
                      onPickerOpen={() => {
                        setAttachMenuOpen(false);
                        setAttachError(null);
                      }}
                      onError={() =>
                        setAttachError(tHuman('composerAttachGoogleDriveError'))
                      }
                      onFilesPicked={(files) => {
                        if (!canAttachDrafts) return;
                        setAttachError(null);
                        pushDrafts(filesToFileList(files));
                      }}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  className={cn(
                    iconButtonClass,
                    'cursor-not-allowed opacity-50',
                  )}
                  aria-label={tHuman('composerAttachMenu')}
                  title={tHuman('composerAttachMenu')}
                  aria-disabled="true"
                  disabled
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={startDictation}
                disabled={isStreaming || composerDisabled}
                className={cn(
                  isDictating ? recordingStopButtonClass : iconButtonClass,
                  !isDictating &&
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0',
                  isDictating
                    ? ''
                    : 'text-muted-foreground hover:bg-primary/12 hover:text-primary',
                  isStreaming && 'cursor-not-allowed opacity-50',
                )}
                aria-label={
                  isDictating
                    ? tHuman('composerStopDictation')
                    : tHuman('composerDictateMessage')
                }
                title={
                  isDictating
                    ? tHuman('composerStopDictation')
                    : tHuman('composerDictateMessage')
                }
              >
                {isDictating ? (
                  <ComposerRecOnAirIndicator />
                ) : (
                  <Mic className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={isStreaming ? () => onStop?.() : sendMessage}
              disabled={
                composerDisabled ||
                (isStreaming ? isHero || !canStop : !canSendWithAttachments)
              }
              className={cn(
                isHero
                  ? heroSendButtonClass
                  : cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0',
                      canSendWithAttachments || canStop
                        ? 'text-primary hover:bg-primary/12 hover:text-primary active:bg-primary/18'
                        : 'cursor-not-allowed text-muted-foreground/50',
                    ),
              )}
              aria-label={
                sendAriaLabel ??
                (isStreaming ? t('stopButton') : t('sendButton'))
              }
              title={
                sendAriaLabel ??
                (isStreaming ? t('stopButton') : t('sendButton'))
              }
            >
              {isStreaming ? (
                isHero ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )
              ) : (
                <Send className={isHero ? 'size-4' : 'h-4 w-4'} aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
