'use client';

import { useCallback, useRef } from 'react';
import { Send, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type AiPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
};

export function AiPanelChatBar({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  placeholder,
}: AiPanelChatBarProps) {
  const t = useTranslations('AiPanel');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim().length > 0 && !isStreaming) {
        onSend();
      }
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  /** Matches {@link HumanChatPanelChatBar} send control — icon-only, same hit target. */
  const sendIconButtonClass = cn(
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0',
    canSend || isStreaming
      ? 'text-primary hover:bg-primary/12 hover:text-primary active:bg-primary/18'
      : 'cursor-not-allowed text-muted-foreground/50',
  );

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col bg-transparent px-3 pb-3 pt-3">
      <div
        className={cn(
          'relative flex min-w-0 flex-col rounded-lg border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
        <div className="relative isolate min-h-[36px] min-w-0 max-h-[160px] w-full overflow-hidden rounded-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            aria-label={placeholder ?? t('placeholder')}
            placeholder={placeholder ?? t('placeholder')}
            rows={1}
            className={cn(
              'relative z-[1] block min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
              'overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-3 py-2.5 text-sm leading-relaxed',
              'text-foreground placeholder:text-muted-foreground focus:outline-none',
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1 px-2 pb-2.5 pt-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <span className="min-w-0 text-xs text-muted-foreground">
                {t('newlineHint')}
              </span>
            </div>
            <button
              type="button"
              onClick={isStreaming ? onStop : onSend}
              disabled={!canSend && !isStreaming}
              className={sendIconButtonClass}
              aria-label={isStreaming ? t('stopButton') : t('sendButton')}
              title={isStreaming ? t('stopButton') : t('sendButton')}
            >
              {isStreaming ? (
                <Square className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
