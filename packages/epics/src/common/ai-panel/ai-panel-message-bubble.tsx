'use client';

import { Bot, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import type { Message } from './mock-data';

type AiPanelMessageBubbleProps = {
  message: Message;
};

export function AiPanelMessageBubble({ message }: AiPanelMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2.5',
        isUser && 'flex-row-reverse',
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          'group max-w-[85%]',
          isUser && 'flex flex-col items-end',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm border border-primary/20 bg-primary/10 text-foreground'
              : 'rounded-tl-sm border border-border bg-muted text-foreground',
          )}
        >
          {message.content}
          {message.isStreaming && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
            </span>
          )}
        </div>
        {!isUser && !message.isStreaming && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Copy"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Thumbs up"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Thumbs down"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
