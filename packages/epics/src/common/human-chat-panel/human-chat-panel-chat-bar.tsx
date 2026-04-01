'use client';

import { useCallback, useRef } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
};

export function HumanChatPanelChatBar({
  value,
  onChange,
  onSend,
  placeholder,
}: HumanChatPanelChatBarProps) {
  const t = useTranslations('HumanChatPanel');
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
      if (value.trim().length > 0) {
        onSend();
      }
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 p-3">
      <div
        className={cn(
          'flex min-w-0 flex-col rounded-2xl border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
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
            'min-h-[36px] min-w-0 max-h-[160px] w-full resize-none',
            'bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed text-foreground',
            'placeholder:text-muted-foreground focus:outline-none',
          )}
          style={{ minHeight: '36px', maxHeight: '160px' }}
        />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 pb-2.5">
          <span className="min-w-0 break-words text-xs text-muted-foreground">
            {t('newlineHint')}
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
            <Send className="h-3 w-3" />
            {t('sendButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
