'use client';

import { tokenizeInlineMarkdown } from '@hypha-platform/ui-utils';

/**
 * Read-only markdown for quest section previews.
 * Same marks the proposal markdown map renders (headings, lists, bold,
 * italic, code), using the shared inline tokenizer so the draft card does
 * not have to compile MDX on every keystroke.
 */
function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {tokenizeInlineMarkdown(text).map((token, index) => {
        const key = `${token.type}-${index}`;
        if (token.type === 'bold') {
          return (
            <strong key={key} className="font-semibold text-foreground">
              {token.value}
            </strong>
          );
        }
        if (token.type === 'italic') {
          return (
            <em key={key} className="italic">
              {token.value}
            </em>
          );
        }
        if (token.type === 'underline') {
          return (
            <u key={key} className="underline">
              {token.value}
            </u>
          );
        }
        if (token.type === 'inlineCode') {
          return (
            <code key={key} className="bg-neutral-3 px-1 text-[12px]">
              {token.value}
            </code>
          );
        }
        if (token.type === 'image') {
          return <span key={key}>{token.alt || token.url}</span>;
        }
        return <span key={key}>{token.value}</span>;
      })}
    </>
  );
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

function parseQuestMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  const pushList = (type: 'ul' | 'ol', item: string) => {
    const previous = blocks[blocks.length - 1];
    if (previous && previous.type === type) {
      previous.items.push(item);
      return;
    }
    blocks.push({ type, items: [item] });
  };

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }
    const bullet = /^\s*(?:[-*•])\s+(.+)$/.exec(line);
    if (bullet?.[1]) {
      pushList('ul', bullet[1].trim());
      index += 1;
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ordered?.[1]) {
      pushList('ol', ordered[1].trim());
      index += 1;
      continue;
    }
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? '';
      if (!next.trim()) break;
      if (/^(#{1,4})\s+/.test(next)) break;
      if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(next)) break;
      paragraph.push(next.trim());
      index += 1;
    }
    blocks.push({ type: 'p', text: paragraph.join(' ') });
  }

  return blocks;
}

const HEADING_CLASS = [
  'text-[15px] font-semibold text-foreground',
  'text-[14px] font-semibold text-foreground',
  'text-[13px] font-semibold text-foreground',
  'text-[13px] font-semibold text-foreground',
] as const;

export function QuestSectionMarkdown({
  markdown,
  empty = 'Not set yet — reply in chat or click to edit',
}: {
  markdown: string | null | undefined;
  empty?: string;
}) {
  const source = markdown?.trim() ?? '';
  if (!source) {
    return <p className="text-[13px] text-neutral-11">{empty}</p>;
  }
  const blocks = parseQuestMarkdown(source);
  return (
    <div className="w-full space-y-1.5 text-[13px] leading-relaxed text-foreground">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={index} className={HEADING_CLASS[block.level - 1]}>
              <InlineMarkdown text={block.text} />
            </p>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const ListTag = block.type === 'ol' ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={
                block.type === 'ol'
                  ? 'list-decimal space-y-0.5 pl-4'
                  : 'list-disc space-y-0.5 pl-4'
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index}>
            <InlineMarkdown text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
