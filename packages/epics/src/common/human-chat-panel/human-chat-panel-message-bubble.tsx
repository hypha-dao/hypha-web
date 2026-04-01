'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Copy, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

type HumanChatPanelMessageBubbleProps = {
  message: {
    id: string;
    role: 'user' | 'member';
    parts?: UIMessagePart[];
    senderName?: string;
  };
  isStreaming?: boolean;
};

export function HumanChatPanelMessageBubble({
  message,
  isStreaming,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const isUser = message.role === 'user';
  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');

  const handleCopy = useCallback(async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [textContent]);

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn('group max-w-[85%]', isUser && 'flex flex-col items-end')}
      >
        {!isUser && message.senderName && (
          <span className="mb-1 text-xs text-muted-foreground">
            {message.senderName}
          </span>
        )}
        <div
          className={cn(
            'flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm border border-primary/20 bg-primary/10 text-foreground'
              : 'rounded-tl-sm border border-border bg-muted text-foreground',
          )}
        >
          {textContent && <span>{textContent}</span>}
          {isStreaming && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
            </span>
          )}
        </div>
        {!isUser && !isStreaming && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!textContent}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={copied ? t('copiedButton') : t('copyButton')}
              title={copied ? t('copiedButton') : t('copyButton')}
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
