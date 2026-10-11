'use client';

import React from 'react';

type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Inline markdown: bold, emphasis, and http(s) links. Text stays text. */
function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (!buf) return;
    out.push({ kind: 'text', text: buf });
    buf = '';
  };

  while (i < source.length) {
    if (source.startsWith('**', i)) {
      const end = source.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: 'strong', text: source.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (source[i] === '*' && source[i + 1] !== '*') {
      const end = source.indexOf('*', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ kind: 'em', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (source[i] === '[') {
      const labelEnd = source.indexOf(']', i + 1);
      if (labelEnd > i + 1 && source[labelEnd + 1] === '(') {
        const hrefEnd = source.indexOf(')', labelEnd + 2);
        if (hrefEnd > labelEnd + 2) {
          const href = safeHref(source.slice(labelEnd + 2, hrefEnd).trim());
          if (href) {
            flush();
            out.push({
              kind: 'link',
              text: source.slice(i + 1, labelEnd),
              href,
            });
            i = hrefEnd + 1;
            continue;
          }
        }
      }
    }
    buf += source[i];
    i += 1;
  }
  flush();
  return out;
}

function InlineText({ source }: { source: string }) {
  return (
    <>
      {parseInline(source).map((part, index) => {
        if (part.kind === 'strong') {
          return (
            <strong key={index} className="font-medium text-foreground">
              {part.text}
            </strong>
          );
        }
        if (part.kind === 'em') {
          return <em key={index}>{part.text}</em>;
        }
        if (part.kind === 'link') {
          return (
            <a
              key={index}
              href={part.href}
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {part.text}
            </a>
          );
        }
        return <React.Fragment key={index}>{part.text}</React.Fragment>;
      })}
    </>
  );
}

function isHeading(line: string): { level: number; text: string } | null {
  let level = 0;
  while (level < line.length && level < 3 && line[level] === '#') level += 1;
  if (level === 0 || line[level] !== ' ') return null;
  const text = line.slice(level + 1).trim();
  if (!text) return null;
  return { level, text };
}

function listMarker(line: string): { ordered: boolean; text: string } | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return { ordered: false, text: trimmed.slice(2).trim() };
  }
  let i = 0;
  while (i < trimmed.length && trimmed[i] >= '0' && trimmed[i] <= '9') i += 1;
  if (i > 0 && trimmed[i] === '.' && trimmed[i + 1] === ' ') {
    return { ordered: true, text: trimmed.slice(i + 2).trim() };
  }
  return null;
}

/** Readable markdown for memory write-ups. No raw HTML. */
export function MemoryProse({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = isHeading(line.trim());
    if (heading) {
      blocks.push(
        <p
          key={key}
          className="mt-4 text-2 font-medium text-foreground first:mt-0"
        >
          <InlineText source={heading.text} />
        </p>,
      );
      key += 1;
      i += 1;
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      const items: string[] = [];
      const ordered = marker.ordered;
      while (i < lines.length) {
        const next = listMarker(lines[i] ?? '');
        if (!next || next.ordered !== ordered) break;
        items.push(next.text);
        i += 1;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List
          key={key}
          className={
            ordered
              ? 'mt-3 list-decimal space-y-1 pl-5 text-2 leading-relaxed text-neutral-12 first:mt-0'
              : 'mt-3 list-disc space-y-1 pl-5 text-2 leading-relaxed text-neutral-12 first:mt-0'
          }
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineText source={item} />
            </li>
          ))}
        </List>,
      );
      key += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim()) {
      if (isHeading((lines[i] ?? '').trim()) || listMarker(lines[i] ?? '')) {
        break;
      }
      paragraph.push((lines[i] ?? '').trim());
      i += 1;
    }
    blocks.push(
      <p
        key={key}
        className="mt-3 text-2 leading-relaxed text-neutral-12 first:mt-0"
      >
        <InlineText source={paragraph.join(' ')} />
      </p>,
    );
    key += 1;
  }

  if (blocks.length === 0) return null;
  return <div className={className}>{blocks}</div>;
}

export function firstMemoryParagraph(source: string): string {
  const trimmed = source.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  const chunks = trimmed.split(/\n\s*\n/).map((part) => part.trim());
  for (const chunk of chunks) {
    const heading = isHeading(chunk);
    if (heading) continue;
    const marker = listMarker(chunk);
    if (marker) return marker.text;
    return chunk.replace(/\n/g, ' ').trim();
  }
  return trimmed.replace(/\n/g, ' ').trim();
}
