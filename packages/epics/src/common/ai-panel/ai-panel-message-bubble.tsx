'use client';

import { useCallback, useState } from 'react';
import { Bot, Copy } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
  input?: { slug?: string };
  output?: unknown;
  errorText?: string;
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; mediaType?: string; url?: string }
  | ToolPart
  | { type: string; [k: string]: unknown };

type AiPanelMessageBubbleProps = {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts?: UIMessagePart[];
  };
  isStreaming?: boolean;
};

export function AiPanelMessageBubble({
  message,
  isStreaming,
}: AiPanelMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');
  const fileParts =
    message.parts?.filter(
      (p): p is { type: 'file'; mediaType?: string; url: string } =>
        p.type === 'file' && typeof (p as { url?: unknown }).url === 'string',
    ) ?? [];
  const toolParts =
    message.parts?.filter(
      (p): p is ToolPart =>
        typeof p.type === 'string' && p.type.startsWith('tool-'),
    ) ?? [];

  const handleCopy = useCallback(async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [textContent]);

  const renderToolOutput = useCallback((output: unknown) => {
    if (!output || typeof output !== 'object') {
      return (
        <span className="text-muted-foreground">Tool call completed.</span>
      );
    }

    const value = output as {
      found?: boolean;
      slug?: string;
      space?: { title?: string; memberCount?: number; documentCount?: number };
      spaceFound?: boolean;
      tokens?: unknown[];
    };

    // get_space_by_slug tool output
    if ('found' in value) {
      if (value.found && value.space) {
        return (
          <span>
            Found <strong>{value.space.title ?? value.slug ?? 'space'}</strong>{' '}
            ({value.slug ?? 'unknown'}) - {value.space.memberCount ?? 0}{' '}
            members, {value.space.documentCount ?? 0} agreements
          </span>
        );
      }
      return (
        <span className="text-muted-foreground">
          No space found for slug &quot;{value.slug ?? 'unknown'}&quot;
        </span>
      );
    }

    // get_tokens tool output
    if ('spaceFound' in value) {
      if (!value.spaceFound) {
        return (
          <span className="text-muted-foreground">
            No space found for slug &quot;{value.slug ?? 'unknown'}&quot;
          </span>
        );
      }
      const tokenCount = Array.isArray(value.tokens) ? value.tokens.length : 0;
      return (
        <span className="text-muted-foreground">
          Retrieved {tokenCount} token{tokenCount === 1 ? '' : 's'} for space
          &quot;{value.slug ?? 'unknown'}&quot;.
        </span>
      );
    }

    return <span className="text-muted-foreground">Tool call completed.</span>;
  }, []);

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn('group max-w-[85%]', isUser && 'flex flex-col items-end')}
      >
        <div
          className={cn(
            'flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm border border-primary/20 bg-primary/10 text-foreground'
              : 'rounded-tl-sm border border-border bg-muted text-foreground',
          )}
        >
          {textContent && textContent !== '(no text)' && (
            <span>{textContent}</span>
          )}
          {fileParts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fileParts.map((part, i) =>
                part.mediaType?.startsWith('image/') && part.url ? (
                  <img
                    key={i}
                    src={part.url}
                    alt=""
                    className="max-h-32 max-w-full rounded-lg object-contain"
                  />
                ) : part.url ? (
                  <a
                    key={i}
                    href={part.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Attachment
                  </a>
                ) : null,
              )}
            </div>
          )}
          {toolParts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {toolParts.map((part) => (
                <div
                  key={part.toolCallId}
                  className="rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs"
                >
                  {part.state === 'input-streaming' && (
                    <span className="text-muted-foreground">
                      Looking up space…
                    </span>
                  )}
                  {part.state === 'input-available' && (
                    <span className="text-muted-foreground">
                      Looking up space
                      {part.input?.slug ? ` "${part.input.slug}"` : ''}…
                    </span>
                  )}
                  {part.state === 'output-available' &&
                    renderToolOutput(part.output)}
                  {part.state === 'output-error' && (
                    <span className="text-destructive">
                      Error: {part.errorText ?? 'Unknown error'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
              title={copied ? 'Copied!' : 'Copy'}
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
