'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

type ConfirmationActionResult = {
  ok?: boolean;
  dry_run?: boolean;
  requires_confirmation?: boolean;
  confirmation_token?: string;
  next_step?: string;
  preview?: Record<string, unknown>;
};

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
  onActionReplySelect?: (text: string) => void;
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function parseHeadingLine(
  line: string,
): { level: 1 | 2 | 3 | 4; text: string } | null {
  let idx = 0;
  while (idx < line.length && line[idx] === '#') idx += 1;
  if (idx === 0 || idx > 4) return null;
  if (line[idx] !== ' ') return null;
  const text = line.slice(idx + 1).trim();
  if (!text) return null;
  return { level: idx as 1 | 2 | 3 | 4, text };
}

function parseUnorderedListItem(line: string): string | null {
  if (line.length < 3) return null;
  const bullet = line[0];
  if (bullet !== '-' && bullet !== '*') return null;
  if (line[1] !== ' ') return null;
  const text = line.slice(2).trim();
  return text || null;
}

function parseOrderedListItem(line: string): string | null {
  if (line.length < 4) return null;
  let idx = 0;
  while (idx < line.length) {
    const ch = line.charAt(idx);
    if (ch < '0' || ch > '9') break;
    idx += 1;
  }
  if (idx === 0 || idx >= line.length) return null;
  const marker = line.charAt(idx);
  if (marker !== '.' && marker !== ')') return null;
  if (line.charAt(idx + 1) !== ' ') return null;
  const text = line.slice(idx + 2).trim();
  return text || null;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let partIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`md-inline-${partIndex++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`md-inline-${partIndex++}`}
          className="rounded bg-muted px-1.5 py-0.5 text-[0.8em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(token);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
}

function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const lines = raw.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i]?.trim() ?? '';
    if (!current) {
      i += 1;
      continue;
    }

    const heading = parseHeadingLine(current);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading.level,
        text: heading.text,
      });
      i += 1;
      continue;
    }

    const ulItems: string[] = [];
    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';
      const item = parseUnorderedListItem(line);
      if (!item) break;
      ulItems.push(item);
      i += 1;
    }
    if (ulItems.length > 0) {
      blocks.push({ type: 'ul', items: ulItems });
      continue;
    }

    const olItems: string[] = [];
    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';
      const item = parseOrderedListItem(line);
      if (!item) break;
      olItems.push(item);
      i += 1;
    }
    if (olItems.length > 0) {
      blocks.push({ type: 'ol', items: olItems });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';
      if (!line) break;
      if (
        parseHeadingLine(line) ||
        parseUnorderedListItem(line) ||
        parseOrderedListItem(line)
      ) {
        break;
      }
      paragraphLines.push(line);
      i += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
      continue;
    }

    i += 1;
  }

  return blocks;
}

export function AiPanelMessageBubble({
  message,
  isStreaming,
  onActionReplySelect,
}: AiPanelMessageBubbleProps) {
  const t = useTranslations('AiPanel');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
  const normalizedTextContent = textContent.trim();
  const textLines = useMemo(() => textContent.split('\n'), [textContent]);
  const markdownBlocks = useMemo(
    () => parseMarkdownBlocks(textContent),
    [textContent],
  );
  const showExpandToggle =
    !isUser &&
    !isStreaming &&
    (textContent.length > 560 || textLines.length > 11);

  const hasVisibleText =
    normalizedTextContent.length > 0 && normalizedTextContent !== '(no text)';
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
  const visibleToolParts = toolParts;

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

  const renderConfirmationCard = useCallback(
    (output: unknown) => {
      if (!output || typeof output !== 'object') return null;
      const value = output as ConfirmationActionResult;
      if (!value.dry_run && !value.requires_confirmation) return null;
      const entries = value.preview ? Object.entries(value.preview) : [];
      return (
        <div className="rounded-lg border border-accent-7/60 bg-accent-3/40 px-2 py-2 text-xs">
          <div className="font-semibold text-accent-11">
            {t('pendingAction')}
          </div>
          {entries.length > 0 ? (
            <div className="mt-1 space-y-1">
              {entries.slice(0, 8).map(([key, raw]) => (
                <div key={key} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{key}:</span>{' '}
                  {typeof raw === 'string' || typeof raw === 'number'
                    ? String(raw)
                    : JSON.stringify(raw)}
                </div>
              ))}
            </div>
          ) : null}
          {value.confirmation_token ? (
            <div className="mt-1 text-muted-foreground">
              {t('confirmWith')}{' '}
              <span className="font-semibold">{value.confirmation_token}</span>
            </div>
          ) : null}
          {value.next_step ? (
            <div className="mt-1 text-muted-foreground">{value.next_step}</div>
          ) : null}
          {value.confirmation_token && onActionReplySelect ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onActionReplySelect(`confirm ${value.confirmation_token}`)
                }
                className="rounded border border-success-8/60 bg-success-3 px-2 py-1 text-[11px] font-semibold text-success-11"
              >
                {t('confirm')}
              </button>
              <button
                type="button"
                onClick={() => onActionReplySelect('cancel this action')}
                className="rounded border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                {t('cancel')}
              </button>
            </div>
          ) : null}
        </div>
      );
    },
    [onActionReplySelect, t],
  );

  const renderToolOutput = useCallback(
    (output: unknown) => {
      const confirmationCard = renderConfirmationCard(output);
      if (confirmationCard) return confirmationCard;
      if (!output || typeof output !== 'object') {
        return (
          <span className="text-muted-foreground">{t('toolCompleted')}</span>
        );
      }
      const value = output as {
        found?: boolean;
        slug?: string;
        space?: {
          title?: string;
          memberCount?: number;
          documentCount?: number;
        };
        spaceFound?: boolean;
        tokens?: unknown[];
      };
      if ('found' in value) {
        if (value.found && value.space) {
          return (
            <span>
              {t('toolFoundSpace', {
                title: value.space.title ?? value.slug ?? 'space',
                slug: value.slug ?? 'unknown',
                memberCount: value.space.memberCount ?? 0,
                documentCount: value.space.documentCount ?? 0,
              })}
            </span>
          );
        }
        return (
          <span className="text-muted-foreground">
            {t('toolNoSpace', { slug: value.slug ?? 'unknown' })}
          </span>
        );
      }
      if ('spaceFound' in value) {
        if (!value.spaceFound) {
          return (
            <span className="text-muted-foreground">
              {t('toolNoSpace', { slug: value.slug ?? 'unknown' })}
            </span>
          );
        }
        const tokenCount = Array.isArray(value.tokens)
          ? value.tokens.length
          : 0;
        return (
          <span className="text-muted-foreground">
            {t('toolTokens', {
              count: tokenCount,
              slug: value.slug ?? 'unknown',
            })}
          </span>
        );
      }
      if (
        'navigation' in value &&
        value.navigation &&
        typeof value.navigation === 'object'
      ) {
        const nav = value.navigation as {
          href?: unknown;
          label?: unknown;
          open_in_new_tab?: unknown;
        };
        const href = typeof nav.href === 'string' ? nav.href : null;
        if (!href) {
          return (
            <span className="text-muted-foreground">{t('toolCompleted')}</span>
          );
        }
        const label =
          typeof nav.label === 'string' && nav.label.trim().length > 0
            ? nav.label
            : 'Open destination';
        const newTab = nav.open_in_new_tab === true;
        return (
          <a
            href={href}
            target={newTab ? '_blank' : undefined}
            rel={newTab ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
          >
            {label}
          </a>
        );
      }
      return (
        <span className="text-muted-foreground">{t('toolCompleted')}</span>
      );
    },
    [renderConfirmationCard, t],
  );

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn('group max-w-[85%]', isUser && 'flex flex-col items-end')}
      >
        <div
          className={cn(
            'flex flex-col gap-1 rounded-2xl px-3 py-2 text-sm leading-snug',
            isUser
              ? 'rounded-tr-sm border border-primary/20 bg-primary/10 text-foreground'
              : 'rounded-tl-sm bg-transparent px-0 py-0 text-foreground',
          )}
        >
          {hasVisibleText && (
            <div className="flex flex-col gap-1">
              <div
                className={cn(
                  'space-y-0.5 break-words text-[14px] leading-5',
                  showExpandToggle && !expanded && 'line-clamp-8',
                )}
              >
                {markdownBlocks.map((block, index) => {
                  if (block.type === 'heading') {
                    return (
                      <div
                        key={`${message.id}-heading-${index}`}
                        className={cn(
                          'font-semibold tracking-tight text-foreground',
                          block.level === 1 && 'text-lg',
                          block.level === 2 && 'text-base',
                          block.level >= 3 &&
                            'text-sm uppercase text-muted-foreground',
                        )}
                      >
                        {renderInlineMarkdown(block.text)}
                      </div>
                    );
                  }
                  if (block.type === 'ul') {
                    return (
                      <ul
                        key={`${message.id}-ul-${index}`}
                        className="space-y-0.5 pl-4 text-foreground"
                      >
                        {block.items.map((item, itemIndex) => (
                          <li
                            key={`${message.id}-ul-item-${index}-${itemIndex}`}
                            className="list-disc"
                          >
                            {renderInlineMarkdown(item)}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  if (block.type === 'ol') {
                    return (
                      <ol
                        key={`${message.id}-ol-${index}`}
                        className="space-y-0.5 pl-4 text-foreground"
                      >
                        {block.items.map((item, itemIndex) => (
                          <li
                            key={`${message.id}-ol-item-${index}-${itemIndex}`}
                            className="list-decimal"
                          >
                            {renderInlineMarkdown(item)}
                          </li>
                        ))}
                      </ol>
                    );
                  }
                  return (
                    <p
                      key={`${message.id}-p-${index}`}
                      className="text-foreground/95"
                    >
                      {renderInlineMarkdown(block.lines.join(' '))}
                    </p>
                  );
                })}
              </div>
              {showExpandToggle && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="self-start text-xs font-medium text-accent-11 underline-offset-2 hover:underline"
                >
                  {expanded ? t('showLess') : t('showMore')}
                </button>
              )}
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
          {visibleToolParts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {visibleToolParts.map((part) => (
                <div
                  key={part.toolCallId}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-xs shadow-sm"
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
                  {part.state === 'output-available' &&
                    renderToolOutput(part.output)}
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
              disabled={!hasVisibleText}
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
