'use client';

import {
  parseQuestRichText,
  type QuestInlineToken,
} from '../utils/quest-rich-text';

/**
 * Read-only markdown for quest section previews.
 * Headings, lists, bold, italic, underline, code, and links stay formatted.
 * TipTap's backslash escapes and HTML entities are shown as the typed characters.
 */
function InlineTokens({ tokens }: { tokens: readonly QuestInlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
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
        if (token.type === 'link') {
          return (
            <a
              key={key}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {token.label}
            </a>
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

const HEADING_CLASS = [
  'text-[15px] font-semibold text-foreground',
  'text-[14px] font-semibold text-foreground',
  'text-[13px] font-semibold text-foreground',
  'text-[13px] font-semibold text-foreground',
] as const;

export function QuestSectionMarkdown({
  markdown,
  empty = 'Not set yet — reply in chat or click to edit',
  variant = 'compact',
}: {
  markdown: string | null | undefined;
  empty?: string;
  /** Overview cards use the same body size as the rest of the app. */
  variant?: 'compact' | 'body';
}) {
  const blocks = parseQuestRichText(markdown);
  const body = variant === 'body';
  if (blocks.length === 0) {
    return (
      <p
        className={
          body
            ? 'text-2 leading-relaxed text-neutral-11'
            : 'text-[13px] text-neutral-11'
        }
      >
        {empty}
      </p>
    );
  }
  return (
    <div
      className={
        body
          ? 'w-full space-y-3 text-2 leading-relaxed text-foreground'
          : 'w-full space-y-1.5 text-[13px] leading-relaxed text-foreground'
      }
    >
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p
              key={index}
              className={
                body
                  ? 'text-2 font-semibold leading-relaxed text-foreground'
                  : HEADING_CLASS[block.level - 1]
              }
            >
              <InlineTokens tokens={block.tokens} />
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
                  ? body
                    ? 'list-decimal space-y-1.5 pl-5'
                    : 'list-decimal space-y-0.5 pl-4'
                  : body
                  ? 'list-disc space-y-1.5 pl-5'
                  : 'list-disc space-y-0.5 pl-4'
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineTokens tokens={item} />
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index}>
            <InlineTokens tokens={block.tokens} />
          </p>
        );
      })}
    </div>
  );
}
