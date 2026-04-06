'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Paperclip, Image, Bold, Smile, AtSign, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type ReplyPreview = {
  authorLabel: string;
  excerpt: string;
  onDismiss: () => void;
};

type HumanChatPanelChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  channelName?: string;
  /** Rich reply: composer preview above the textarea */
  replyPreview?: ReplyPreview;
};

export function HumanChatPanelChatBar({
  value,
  onChange,
  onSend,
  placeholder,
  channelName,
  replyPreview,
}: HumanChatPanelChatBarProps) {
  const t = useTranslations('HumanChatPanel');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyPreview) {
      textareaRef.current?.focus();
    }
  }, [replyPreview]);

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

  const defaultPlaceholder = channelName
    ? t('placeholderChannel', { channel: channelName })
    : t('placeholder');

  // TODO: Implement handlers for attachment/formatting buttons
  const handleAttachFile = () => {};
  const handleAttachImage = () => {};
  const handleBold = () => {};
  const handleEmoji = () => {};
  const handleMention = () => {};

  const iconButtonClass =
    'flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors';

  return (
    <div className="flex w-full min-w-0 flex-shrink-0 flex-col border-t border-border bg-background-2 p-3">
      <div
        className={cn(
          'flex min-w-0 flex-col rounded-2xl border border-border bg-muted/50',
          'transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
        )}
      >
        {replyPreview && (
          <div
            data-testid="chat-reply-preview"
            className="flex items-start gap-2 border-b border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                {t('replyingTo', { author: replyPreview.authorLabel })}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {replyPreview.excerpt}
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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
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
              <Image className="h-4 w-4" />
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
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('emoji')}
              title={t('emoji')}
              onClick={handleEmoji}
            >
              <Smile className="h-4 w-4" />
            </button>
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
