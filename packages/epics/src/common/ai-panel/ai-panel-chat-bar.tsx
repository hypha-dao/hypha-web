'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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
          className="motion-safe:relative inline-block h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/25 dark:ring-white/15"
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

type AiPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  draftAttachments?: File[];
  onDraftAttachmentsChange?: (files: File[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
};

export function AiPanelChatBar({
  value,
  onChange,
  onSend,
  draftAttachments = [],
  onDraftAttachmentsChange,
  onStop,
  isStreaming = false,
  placeholder,
}: AiPanelChatBarProps) {
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  valueRef.current = value;

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      // Always collapse to single-line composer when cleared/reopened.
      el.style.height = '36px';
      return;
    }
    autoResize();
  }, [value, autoResize]);

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
  const canAttachDrafts = typeof onDraftAttachmentsChange === 'function';
  const pushDrafts = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || !onDraftAttachmentsChange) return;
      onDraftAttachmentsChange([...draftAttachments, ...Array.from(files)]);
    },
    [draftAttachments, onDraftAttachmentsChange],
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

  const iconButtonClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-primary/12 hover:text-primary active:bg-primary/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0';

  useEffect(() => {
    if (!canAttachDrafts && attachMenuOpen) {
      setAttachMenuOpen(false);
    }
  }, [attachMenuOpen, canAttachDrafts]);

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col bg-transparent px-3 pb-3 pt-3">
      <div
        className={cn(
          'flex min-w-0 flex-col rounded-lg border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={isDictating}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          aria-label={placeholder ?? t('placeholder')}
          placeholder={placeholder ?? t('placeholder')}
          rows={1}
          className={cn(
            'min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
            'bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
          style={{ minHeight: '36px', maxHeight: '160px' }}
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

        <div className="flex min-w-0 flex-col gap-1 px-2 pb-2.5 pt-0">
          {dictationError && (
            <p role="alert" className="px-1 text-xs text-destructive">
              {dictationError}
            </p>
          )}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              {canAttachDrafts ? (
                <DropdownMenu
                  modal={false}
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
                  <DropdownMenuContent align="start" className="min-w-[200px]">
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
                disabled={isStreaming}
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
              disabled={isStreaming ? !canStop : !canSendWithAttachments}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0',
                canSendWithAttachments || canStop
                  ? 'text-primary hover:bg-primary/12 hover:text-primary active:bg-primary/18'
                  : 'cursor-not-allowed text-muted-foreground/50',
              )}
              aria-label={isStreaming ? t('stopButton') : t('sendButton')}
              title={isStreaming ? t('stopButton') : t('sendButton')}
            >
              {isStreaming ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
