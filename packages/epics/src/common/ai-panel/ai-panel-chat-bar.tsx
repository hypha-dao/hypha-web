'use client';

import { useRef } from 'react';
import {
  Code2,
  Image,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
} from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

type AiPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming?: boolean;
  placeholder?: string;
};

export function AiPanelChatBar({
  value,
  onChange,
  onSend,
  isStreaming = false,
  placeholder = 'Ask Hypha AI anything...',
}: AiPanelChatBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 p-3">
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
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Image"
            aria-label="Add image"
          >
            <Image className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Code"
            aria-label="Add code snippet"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Search web"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Voice"
            aria-label="Voice input"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        </div>

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
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
              canSend
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
