'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Code2,
  Image,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

const ACCEPT_FILE = 'image/*,application/pdf,text/*';
const ACCEPT_IMAGE = 'image/*';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  0?: { transcript?: string };
  length: number;
}

function AttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1.5">
      {url ? (
        <img
          src={url}
          alt={file.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <span className="max-w-[80px] truncate text-xs text-muted-foreground">
          {file.name}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Remove attachment"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

type AiPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  attachments?: File[];
  onAttachmentsChange?: (files: File[]) => void;
  isStreaming?: boolean;
  placeholder?: string;
};

export function AiPanelChatBar({
  value,
  onChange,
  onSend,
  onStop,
  attachments = [],
  onAttachmentsChange,
  isStreaming = false,
  placeholder = 'Ask Hypha AI anything...',
}: AiPanelChatBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onAttachmentsChange) {
      onAttachmentsChange([...attachments, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((_, i) => i !== index));
    }
  };

  const insertCodeBlock = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const wrapper = selected ? `\`\`\`\n${selected}\n\`\`\`` : '\n```\n\n```\n';
    const newValue = value.slice(0, start) + wrapper + value.slice(end);
    onChange(newValue);
    ta.focus();
  };

  const toggleVoiceInput = useCallback(() => {
    if (
      !('webkitSpeechRecognition' in window) &&
      !('SpeechRecognition' in window)
    ) {
      return;
    }
    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (e: SpeechRecognitionResultEvent) => {
      const results = Array.from(e.results) as SpeechRecognitionResult[];
      const transcript = results.map((r) => r[0]?.transcript ?? '').join('');
      if (transcript) {
        onChange(value + (value ? ' ' : '') + transcript);
        autoResize();
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.start();
    setIsListening(true);
  }, [isListening, value, onChange, autoResize]);

  const canSend =
    (value.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FILE}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className={cn(
          'flex min-w-0 flex-col rounded-2xl border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
        {/* Toolbar */}
        <div className="flex min-w-0 items-center gap-1 px-3 pt-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!onAttachmentsChange}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={!onAttachmentsChange}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Add image"
            aria-label="Add image"
          >
            <Image className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={insertCodeBlock}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Insert code block"
            aria-label="Add code snippet"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/50"
            title="Search (coming soon)"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={cn(
              'rounded-lg p-1.5 transition-colors hover:bg-muted hover:text-foreground',
              isListening
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground',
            )}
            title="Voice input"
            aria-label="Voice input"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-2 px-3 py-2">
            {attachments.map((file, i) => (
              <AttachmentPreview
                key={`${file.name}-${file.size}-${i}`}
                file={file}
                onRemove={() => removeAttachment(i)}
              />
            ))}
          </div>
        )}

        {/* Textarea — full width */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
            'bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
          style={{ minHeight: '36px', maxHeight: '160px' }}
        />

        {/* Bottom bar */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 pb-2.5">
          <span className="min-w-0 break-words text-xs text-muted-foreground">
            Shift+Enter for newline
          </span>
          <button
            type="button"
            onClick={isStreaming ? onStop : onSend}
            disabled={!canSend && !isStreaming}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
              canSend || isStreaming
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            {isStreaming ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Send className="h-3 w-3" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
