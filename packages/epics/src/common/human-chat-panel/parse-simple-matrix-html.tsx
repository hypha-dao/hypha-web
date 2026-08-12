'use client';

import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';

import { cn } from '@hypha-platform/ui-utils';

export type SimpleHtmlNode =
  | { type: 'text'; value: string }
  | { type: 'linebreak' }
  | { type: 'bold'; children: SimpleHtmlNode[] }
  | { type: 'italic'; children: SimpleHtmlNode[] }
  | { type: 'underline'; children: SimpleHtmlNode[] }
  | { type: 'strike'; children: SimpleHtmlNode[] }
  | { type: 'code'; value: string }
  | { type: 'spoiler'; children: SimpleHtmlNode[] }
  | { type: 'blockquote'; children: SimpleHtmlNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; children: SimpleHtmlNode[] }
  | { type: 'ul'; items: SimpleHtmlNode[][] }
  | { type: 'ol'; items: SimpleHtmlNode[][] };

/**
 * Minimal HTML → nodes for safe React rendering (subset from Matrix formatted_body).
 * Parses via DOMParser (no regex tag stripping); drops script/style; unknown tags → children or text only.
 */
export function parseSimpleMatrixHtml(html: string): SimpleHtmlNode[] {
  const normalized = html.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const doc = new DOMParser().parseFromString(normalized, 'text/html');
  const body = doc.body;
  if (!body) {
    return [];
  }

  const walk = (node: Node): SimpleHtmlNode[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.textContent ?? '';
      return v ? [{ type: 'text', value: v }] : [];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') {
      return [];
    }
    if (tag === 'br') {
      return [{ type: 'linebreak' }];
    }
    const childNodes = Array.from(el.childNodes).flatMap(walk);
    switch (tag) {
      case 'strong':
      case 'b':
        return [{ type: 'bold', children: childNodes }];
      case 'em':
      case 'i':
        return [{ type: 'italic', children: childNodes }];
      case 'u':
        return [{ type: 'underline', children: childNodes }];
      case 'del':
      case 's':
        return [{ type: 'strike', children: childNodes }];
      case 'code':
        return [{ type: 'code', value: el.textContent ?? '' }];
      case 'blockquote':
        return [{ type: 'blockquote', children: childNodes }];
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4': {
        const level = Number(tag.slice(1)) as 1 | 2 | 3 | 4;
        return [{ type: 'heading', level, children: childNodes }];
      }
      case 'ul':
      case 'ol': {
        const items: SimpleHtmlNode[][] = [];
        for (const child of Array.from(el.children)) {
          if (child.tagName.toLowerCase() !== 'li') continue;
          items.push(Array.from(child.childNodes).flatMap(walk));
        }
        if (items.length === 0 && childNodes.length > 0) {
          items.push(childNodes);
        }
        return [{ type: tag === 'ul' ? 'ul' : 'ol', items }];
      }
      case 'li':
        // Handled by ul/ol parent; standalone → flatten.
        return childNodes;
      case 'span': {
        const spoiler =
          el.getAttribute('data-mx-spoiler') != null ||
          el.classList.contains('mx_EventTile_spoiler');
        if (spoiler) {
          return [{ type: 'spoiler', children: childNodes }];
        }
        return childNodes;
      }
      case 'p':
      case 'div':
        return childNodes;
      default:
        return childNodes.length > 0
          ? childNodes
          : [{ type: 'text', value: el.textContent ?? '' }];
    }
  };

  return Array.from(body.childNodes).flatMap(walk);
}

function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      className={cn(
        'mx-0.5 cursor-pointer rounded px-0.5 align-baseline transition-all',
        revealed
          ? 'bg-muted text-foreground'
          : 'bg-foreground/15 text-transparent blur-sm hover:blur-[3px]',
      )}
      onClick={() => setRevealed((r) => !r)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setRevealed((r) => !r);
        }
      }}
    >
      {children}
    </span>
  );
}

const headingClassName: Record<1 | 2 | 3 | 4, string> = {
  1: 'text-base font-semibold leading-snug',
  2: 'text-[0.95rem] font-semibold leading-snug',
  3: 'text-sm font-semibold leading-snug',
  4: 'text-sm font-medium leading-snug',
};

export function renderSimpleHtmlNodes(
  nodes: SimpleHtmlNode[],
  keyPrefix = '',
  /** Rewrite plain text segments (e.g. resolve `@user:host` Matrix IDs to display names). */
  transformText?: (fragment: string) => ReactNode,
): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${keyPrefix}${i}`;
    switch (n.type) {
      case 'text':
        return transformText ? (
          <span key={k}>{transformText(n.value)}</span>
        ) : (
          <Fragment key={k}>{n.value}</Fragment>
        );
      case 'linebreak':
        return <br key={k} />;
      case 'code':
        return (
          <code
            key={k}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
          >
            {n.value}
          </code>
        );
      case 'bold':
        return (
          <strong key={k} className="font-semibold">
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </strong>
        );
      case 'italic':
        return (
          <em key={k} className="italic">
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </em>
        );
      case 'underline':
        return (
          <u key={k} className="underline underline-offset-2">
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </u>
        );
      case 'strike':
        return (
          <del key={k} className="line-through opacity-90">
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </del>
        );
      case 'spoiler':
        return (
          <SpoilerSpan key={k}>
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </SpoilerSpan>
        );
      case 'blockquote':
        return (
          <span
            key={k}
            className="my-0.5 block border-l-2 border-muted-foreground/40 pl-2 text-muted-foreground"
          >
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </span>
        );
      case 'heading': {
        const HeadingTag = `h${n.level}` as 'h1' | 'h2' | 'h3' | 'h4';
        return (
          <HeadingTag
            key={k}
            className={cn('my-0.5', headingClassName[n.level])}
          >
            {renderSimpleHtmlNodes(n.children, `${k}-`, transformText)}
          </HeadingTag>
        );
      }
      case 'ul':
        return (
          <ul
            key={k}
            className="my-0.5 list-disc space-y-0.5 pl-4 text-inherit"
          >
            {n.items.map((item, itemIndex) => (
              <li key={`${k}-li-${itemIndex}`}>
                {renderSimpleHtmlNodes(
                  item,
                  `${k}-li-${itemIndex}-`,
                  transformText,
                )}
              </li>
            ))}
          </ul>
        );
      case 'ol':
        return (
          <ol
            key={k}
            className="my-0.5 list-decimal space-y-0.5 pl-4 text-inherit"
          >
            {n.items.map((item, itemIndex) => (
              <li key={`${k}-li-${itemIndex}`}>
                {renderSimpleHtmlNodes(
                  item,
                  `${k}-li-${itemIndex}-`,
                  transformText,
                )}
              </li>
            ))}
          </ol>
        );
      default:
        return null;
    }
  });
}

export function ChatMessageRichText({
  html,
  transformText,
}: {
  html: string;
  transformText?: (fragment: string) => ReactNode;
}) {
  const nodes = parseSimpleMatrixHtml(html);
  return <>{renderSimpleHtmlNodes(nodes, '', transformText)}</>;
}
