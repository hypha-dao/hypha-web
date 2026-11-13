import { canonicalizeRichTextMarkdown } from '@hypha-platform/ui';

export type QuestInlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'underline'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'image'; alt: string; url: string };

export type QuestRichTextBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; tokens: QuestInlineToken[] }
  | { type: 'ul'; items: QuestInlineToken[][] }
  | { type: 'ol'; items: QuestInlineToken[][] }
  | { type: 'p'; tokens: QuestInlineToken[] };

/**
 * TipTap's markdown serializer backslash-escapes literal brackets and other
 * inline marks, and encodes `>` as `&gt;`. One decode pass restores the
 * characters the author typed. A second pass would eat a real backslash.
 * `&amp;` is last so `&amp;gt;` stays `&gt;`.
 */
function decodeTiptapHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function unescapeBackslashes(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && i + 1 < text.length) {
      out += text[i + 1];
      i += 1;
      continue;
    }
    out += text[i];
  }
  return out;
}

function restoreLiteralCharacters(text: string): string {
  return decodeTiptapHtmlEntities(unescapeBackslashes(text));
}

function readWrapped(
  text: string,
  index: number,
  marker: '!' | '',
): { label: string; url: string; end: number } | null {
  const start = marker === '!' ? index + 1 : index;
  if (marker === '!' && text[index] !== '!') return null;
  if (text[start] !== '[') return null;
  const closeBracket = text.indexOf(']', start + 1);
  if (closeBracket === -1 || text[closeBracket + 1] !== '(') return null;
  const closeParen = text.indexOf(')', closeBracket + 2);
  if (closeParen === -1) return null;
  return {
    label: text.slice(start + 1, closeBracket),
    url: text.slice(closeBracket + 2, closeParen),
    end: closeParen + 1,
  };
}

function findClosing(text: string, openEnd: number, delim: string): number {
  return text.indexOf(delim, openEnd);
}

function findClosingSingleStar(text: string, openEnd: number): number {
  for (let i = openEnd; i < text.length; i += 1) {
    if (text[i] === '\\') {
      i += 1;
      continue;
    }
    if (text[i] === '*' && text[i + 1] !== '*') return i;
  }
  return -1;
}

function pushText(tokens: QuestInlineToken[], value: string) {
  const restored = restoreLiteralCharacters(value);
  if (!restored) return;
  const previous = tokens[tokens.length - 1];
  if (previous?.type === 'text') {
    previous.value += restored;
    return;
  }
  tokens.push({ type: 'text', value: restored });
}

/** Inline marks, with TipTap escapes kept as the typed characters. */
export function tokenizeQuestInlineMarkdown(text: string): QuestInlineToken[] {
  const tokens: QuestInlineToken[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      pushText(tokens, text.slice(i, i + 2));
      i += 2;
      continue;
    }

    const image = readWrapped(text, i, '!');
    if (image) {
      tokens.push({
        type: 'image',
        alt: restoreLiteralCharacters(image.label),
        url: image.url,
      });
      i = image.end;
      continue;
    }

    const link = readWrapped(text, i, '');
    if (link) {
      tokens.push({
        type: 'link',
        label: restoreLiteralCharacters(link.label),
        url: link.url,
      });
      i = link.end;
      continue;
    }

    if (text[i] === '*' && text[i + 1] === '*') {
      const end = findClosing(text, i + 2, '**');
      if (end !== -1) {
        tokens.push({
          type: 'bold',
          value: restoreLiteralCharacters(text.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '_' && text[i + 1] === '_') {
      const end = findClosing(text, i + 2, '__');
      if (end !== -1) {
        tokens.push({
          type: 'underline',
          value: restoreLiteralCharacters(text.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = findClosingSingleStar(text, i + 1);
      if (end !== -1 && end > i + 1) {
        tokens.push({
          type: 'italic',
          value: restoreLiteralCharacters(text.slice(i + 1, end)),
        });
        i = end + 1;
        continue;
      }
    }

    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1 && end > i + 1) {
        tokens.push({ type: 'inlineCode', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    let next = i + 1;
    while (next < text.length) {
      if (text[next] === '\\') break;
      if (text[next] === '`') break;
      if (text[next] === '[') break;
      if (text[next] === '!' && text[next + 1] === '[') break;
      if (text[next] === '*' && text[next + 1] === '*') break;
      if (text[next] === '_' && text[next + 1] === '_') break;
      if (text[next] === '*' && text[next + 1] !== '*') break;
      next += 1;
    }
    pushText(tokens, text.slice(i, next));
    i = next;
  }

  return tokens;
}

function parseQuestRichTextLines(source: string): QuestRichTextBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: QuestRichTextBlock[] = [];
  let index = 0;

  const pushList = (type: 'ul' | 'ol', item: string) => {
    const tokens = tokenizeQuestInlineMarkdown(item);
    const previous = blocks[blocks.length - 1];
    if (previous && previous.type === type) {
      previous.items.push(tokens);
      return;
    }
    blocks.push({ type, items: [tokens] });
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
        tokens: tokenizeQuestInlineMarkdown(heading[2].trim()),
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
    blocks.push({
      type: 'p',
      tokens: tokenizeQuestInlineMarkdown(paragraph.join(' ')),
    });
  }

  return blocks;
}

export function parseQuestRichText(
  markdown: string | null | undefined,
): QuestRichTextBlock[] {
  const source = markdown?.trim() ?? '';
  if (!source) return [];
  return parseQuestRichTextLines(source);
}

function inlinePlain(tokens: readonly QuestInlineToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'image') return token.alt || token.url;
      if (token.type === 'link') return token.label;
      return token.value;
    })
    .join('');
}

/**
 * Editor save for Goal, Scope, Success, and milestone descriptions.
 * Italic from `*x*` or `_x_` is kept as italic. The string is stable if saved again.
 */
export function storedQuestRichText(markdown: string): string {
  return canonicalizeRichTextMarkdown(markdown);
}

/** Deliverable name, link, and note are plain inputs, not rich text. */
export function storedQuestPlainField(value: string): string {
  return value.trim();
}

/** Characters a reader sees, with formatting marks removed and escapes undone. */
export function questRichTextPlain(
  markdown: string | null | undefined,
): string {
  return parseQuestRichText(markdown)
    .map((block) => {
      if (block.type === 'ul' || block.type === 'ol') {
        return block.items.map((item) => inlinePlain(item)).join('\n');
      }
      return inlinePlain(block.tokens);
    })
    .join('\n');
}
