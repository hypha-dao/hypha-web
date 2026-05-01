'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Bot, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

/**
 * Models often emit markdown-ish lists on one line: `Intro: * a * b * c`.
 * Break those into real line breaks so each bullet reads as its own row.
 */
function normalizeAssistantListText(raw: string): string {
  let s = raw;
  // "...colon * first item" → newline before first bullet
  s = s.replace(/:\s*\*\s+/g, ':\n• ');
  // Remaining inline bullets: space + asterisk + space before next segment
  s = s.replace(/\s+\*\s+(?=\S)/g, '\n• ');
  // Hyphen list only right after a colon (avoid splitting "word - word" in prose)
  s = s.replace(/:\s*-\s+/g, ':\n– ');
  return s;
}

export function AiPanelMessageBubble({
  message,
  isStreaming,
}: AiPanelMessageBubbleProps) {
  const t = useTranslations('AiPanel');
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
  /** Tool success summaries (e.g. "Found X — N members") duplicate the assistant text; keep loading + errors only. */
  const toolPartsForUi = toolParts.filter(
    (p) => p.state !== 'output-available',
  );

  const assistantDisplayText =
    !isUser && textContent && textContent !== '(no text)'
      ? normalizeAssistantListText(textContent)
      : textContent;

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
          {assistantDisplayText && assistantDisplayText !== '(no text)' && (
            <div
              className={cn(
                !isUser &&
                  'whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
              )}
            >
              {assistantDisplayText}
            </div>
          )}
          {fileParts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fileParts.map((part, i) =>
                part.mediaType?.startsWith('image/') && part.url ? (
                  <img
                    key={i}
                    src={part.url}
                    alt={`Uploaded image ${i + 1}`}
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
                    {t('attachment')}
                  </a>
                ) : null,
              )}
            </div>
          )}
          {toolPartsForUi.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {toolPartsForUi.map((part) => (
                <div
                  key={part.toolCallId}
                  className="rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs"
                >
                  {part.state === 'input-streaming' && (
                    <span className="text-muted-foreground">
                      {t('toolLookingUp')}
                    </span>
                  )}
                  {part.state === 'input-available' && (
                    <span className="text-muted-foreground">
                      {part.input?.slug
                        ? t('toolLookingUpSlug', { slug: part.input.slug })
                        : t('toolLookingUp')}
                    </span>
                  )}
                  {part.state === 'output-error' && (
                    <span className="text-destructive">
                      {t('toolError', {
                        message: part.errorText ?? 'Unknown error',
                      })}
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
