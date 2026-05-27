'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

import { type AiCompetencyAgent } from '../ai-agent-competencies';
import { AiPanelMobilizedAgents } from './ai-panel-mobilized-agents';

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
  mobilizedAgents?: readonly AiCompetencyAgent[];
  isStreaming?: boolean;
  onActionReplySelect?: (text: string) => void;
};

type OlListItem = {
  text: string;
  nestedUl?: string[];
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: OlListItem[] };

function joinTextPartsWithSpacing(parts: Array<{ text: string }>): string {
  if (parts.length === 0) return '';
  let joined = '';
  for (const part of parts) {
    const next = part.text ?? '';
    if (!next) continue;
    if (!joined) {
      joined = next;
      continue;
    }
    const prevChar = joined.charAt(joined.length - 1);
    const nextChar = next.charAt(0);
    const needsSpacer =
      prevChar.length > 0 &&
      nextChar.length > 0 &&
      !/\s/.test(prevChar) &&
      !/\s/.test(nextChar) &&
      /[A-Za-z0-9)\]]/.test(prevChar) &&
      /[A-Za-z0-9(\[]/.test(nextChar);
    joined += needsSpacer ? ` ${next}` : next;
  }
  return joined;
}

const confirmationPreviewLabels: Record<string, string> = {
  title: 'Space name',
  description: 'Purpose',
  parent_space_name: 'Parent space',
  links: 'Links',
  categories: 'Categories',
  flags: 'Labels',
};

function formatConfirmationPreviewValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const value = raw.trim();
    return value.length > 0 ? value : null;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const normalized = raw
      .map((item) =>
        typeof item === 'string' || typeof item === 'number'
          ? String(item).trim()
          : '',
      )
      .filter(Boolean);
    return normalized.length > 0
      ? normalized.join(', ')
      : `${raw.length} item(s)`;
  }
  return null;
}

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
  const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
  if (!bulletMatch) return null;
  const text = bulletMatch[1]?.trim() ?? '';
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

const CONFIDENCE_SCORE_PATTERN =
  /(\*{0,2}Confidence\*{0,2}\s*:?\s*)(0?\.\d+|1(?:\.0+)?)\b/gi;

function formatConfidenceScore(raw: string): string | null {
  const num = Number.parseFloat(raw);
  if (!Number.isFinite(num)) return null;
  if (num >= 0 && num <= 1) return `${Math.round(num * 100)}%`;
  if (num > 1 && num <= 100) return `${Math.round(num)}%`;
  return null;
}

/** Show model confidence as a percentage (0.8 → 80%) in AI panel copy. */
function formatConfidenceDisplay(text: string): string {
  return text.replace(CONFIDENCE_SCORE_PATTERN, (match, prefix, raw) => {
    const formatted = formatConfidenceScore(raw);
    return formatted ? `${prefix}${formatted}` : match;
  });
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const displayText = formatConfidenceDisplay(text);
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let partIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(displayText)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(displayText.slice(lastIndex, start));
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

  if (lastIndex < displayText.length) {
    nodes.push(displayText.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : displayText;
}

/** Merge split `ol` blocks so numbering continues after nested bullet sub-lists. */
function mergeAdjacentOrderedListBlocks(
  blocks: MarkdownBlock[],
): MarkdownBlock[] {
  const merged: MarkdownBlock[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (block.type === 'ol' && previous?.type === 'ol') {
      previous.items.push(...block.items);
      continue;
    }
    merged.push(block);
  }
  return merged;
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

    const olItems: OlListItem[] = [];
    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';
      const item = parseOrderedListItem(line);
      if (!item) break;
      i += 1;
      const nestedUl: string[] = [];
      while (i < lines.length) {
        const nestedLine = lines[i]?.trim() ?? '';
        const ulItem = parseUnorderedListItem(nestedLine);
        if (!ulItem) break;
        nestedUl.push(ulItem);
        i += 1;
      }
      olItems.push(
        nestedUl.length > 0 ? { text: item, nestedUl } : { text: item },
      );
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

  return mergeAdjacentOrderedListBlocks(blocks);
}

export function AiPanelMessageBubble({
  message,
  mobilizedAgents = [],
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
  const textContent = joinTextPartsWithSpacing(textParts);
  const normalizedTextContent = textContent.trim();
  const textLines = useMemo(() => textContent.split('\n'), [textContent]);
  const markdownBlocks = useMemo(
    () => parseMarkdownBlocks(textContent),
    [textContent],
  );
  const showMoreLabel = t('showMore');
  const showLessLabel = t('showLess');
  const hasExpandTranslations =
    showMoreLabel !== 'AiPanel.showMore' &&
    showLessLabel !== 'AiPanel.showLess';
  const showExpandToggle =
    !isUser &&
    !isStreaming &&
    hasExpandTranslations &&
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
  const shouldHideToolPart = (part: ToolPart) => {
    // Keep tool cards only for actionable confirmation steps.
    if (part.state === 'output-available') {
      const output = part.output as ConfirmationActionResult | undefined;
      const isActionableConfirmation =
        output?.requires_confirmation === true || output?.dry_run === true;
      if (!isActionableConfirmation) return true;
    }
    // Never surface raw tool errors in chat cards.
    if (part.state === 'output-error') return true;
    // Hide low-level tool state cards from the conversation flow.
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return true;
    }
    if (
      part.type === 'tool-onboarding_guidance' &&
      part.state === 'output-available'
    ) {
      return true;
    }
    if (
      part.type === 'tool-create_space_from_onboarding' &&
      part.state === 'output-available'
    ) {
      const output = part.output as
        | { ok?: boolean; requires_wallet_signature?: boolean }
        | undefined;
      if (output?.ok === true && output?.requires_wallet_signature === true) {
        return true;
      }
    }
    return false;
  };
  const renderedToolParts = visibleToolParts.filter(
    (part) => !shouldHideToolPart(part),
  );
  const isTypingOnly =
    !isUser &&
    isStreaming &&
    !hasVisibleText &&
    fileParts.length === 0 &&
    renderedToolParts.length === 0;
  const isSingleLineAssistantText =
    !isUser &&
    !isStreaming &&
    hasVisibleText &&
    fileParts.length === 0 &&
    renderedToolParts.length === 0 &&
    markdownBlocks.length === 1 &&
    markdownBlocks[0]?.type === 'paragraph' &&
    markdownBlocks[0].lines.length === 1 &&
    (markdownBlocks[0].lines[0]?.length ?? 0) <= 110;

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
      const entries = value.preview
        ? Object.entries(value.preview)
            .map(([key, raw]) => {
              if (key.includes('slug')) return null;
              const displayValue = formatConfirmationPreviewValue(raw);
              if (!displayValue) return null;
              return {
                key,
                label:
                  confirmationPreviewLabels[key] ?? key.replaceAll('_', ' '),
                value: displayValue,
              };
            })
            .filter(
              (item): item is { key: string; label: string; value: string } =>
                item !== null,
            )
        : [];
      const confirmationToken = value.confirmation_token?.trim();
      const hasQuickActions =
        Boolean(confirmationToken) && Boolean(onActionReplySelect);
      return (
        <div className="rounded-xl border border-accent-8/55 bg-accent-3/30 px-3 py-3 text-xs shadow-[0_8px_22px_-18px_rgba(0,0,0,0.7)]">
          <div className="font-semibold text-accent-11">
            {t('pendingAction')}
          </div>
          {entries.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {entries.slice(0, 6).map((entry) => (
                <div key={entry.key} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {entry.label}:
                  </span>{' '}
                  {entry.value}
                </div>
              ))}
            </div>
          ) : null}
          {!hasQuickActions && confirmationToken ? (
            <div className="mt-1 text-muted-foreground">
              {t('confirmWith')}{' '}
              <span className="font-semibold">{confirmationToken}</span>
            </div>
          ) : null}
          {value.next_step ? (
            <div className="mt-1 text-muted-foreground">{value.next_step}</div>
          ) : null}
          {hasQuickActions ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onActionReplySelect?.('yes, proceed')}
                className="rounded-md border border-accent-8/45 bg-gradient-to-r from-accent-9/95 to-accent-10/95 px-3 py-1.5 text-[11px] font-semibold text-accent-contrast shadow-[0_10px_20px_-16px_oklch(0.62_0.19_278)] ring-1 ring-accent-11/12 transition-all hover:brightness-105 hover:ring-accent-11/22"
              >
                {t('confirm')}
              </button>
              <button
                type="button"
                onClick={() => onActionReplySelect?.('cancel this action')}
                className="rounded-md border border-border/70 bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
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

  return (
    <div
      className={cn(
        'flex gap-2',
        isUser && 'flex-row-reverse',
        isSingleLineAssistantText && 'items-center',
      )}
    >
      {!isUser && (
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary',
            isSingleLineAssistantText ? 'mt-0' : 'mt-0.5',
          )}
        >
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
              : isTypingOnly
              ? 'rounded-tl-sm border border-border/70 bg-background/70 px-3 py-2 text-foreground shadow-sm'
              : 'rounded-tl-sm bg-transparent px-0 py-0 text-foreground',
          )}
        >
          {!isUser && mobilizedAgents.length > 0 ? (
            <AiPanelMobilizedAgents
              agents={mobilizedAgents}
              isStreaming={isStreaming}
            />
          ) : null}
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
                            {renderInlineMarkdown(item.text)}
                            {item.nestedUl && item.nestedUl.length > 0 ? (
                              <ul className="mt-0.5 space-y-0.5 pl-4">
                                {item.nestedUl.map(
                                  (nestedItem, nestedIndex) => (
                                    <li
                                      key={`${message.id}-ol-item-${index}-${itemIndex}-ul-${nestedIndex}`}
                                      className="list-disc"
                                    >
                                      {renderInlineMarkdown(nestedItem)}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : null}
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
            <div
              className={cn('flex flex-col gap-2', hasVisibleText && 'mt-1')}
            >
              {fileParts.map((part, i) =>
                part.mediaType?.startsWith('image/') && part.url ? (
                  <img
                    key={i}
                    src={part.url}
                    alt={t('uploadedImageAlt', { index: i + 1 })}
                    className="max-h-72 max-w-full rounded-lg object-contain"
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
          {renderedToolParts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {renderedToolParts.map((part) => {
                const confirmationCard =
                  part.state === 'output-available'
                    ? renderConfirmationCard(part.output)
                    : null;
                if (confirmationCard) {
                  return <div key={part.toolCallId}>{confirmationCard}</div>;
                }
                return null;
              })}
            </div>
          )}
          {isStreaming && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5',
                isTypingOnly && 'rounded-full bg-muted/70 px-2 py-1',
                !isTypingOnly && 'ml-1',
              )}
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
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
