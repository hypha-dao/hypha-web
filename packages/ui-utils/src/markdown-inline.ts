export type InlineMarkdownToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'image'; alt: string; url: string };

/** Remove `![alt](url)` tokens without regex backtracking (ReDoS-safe). */
export function removeMarkdownImageTokens(markdown: string): string {
  const tokens: string[] = [];
  let i = 0;

  while (i < markdown.length) {
    if (markdown[i] === '!' && markdown[i + 1] === '[') {
      const closeBracket = markdown.indexOf(']', i + 2);
      if (closeBracket !== -1 && markdown[closeBracket + 1] === '(') {
        const closeParen = markdown.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          i = closeParen + 1;
          continue;
        }
      }
    }

    tokens.push(markdown.charAt(i));
    i += 1;
  }

  return tokens.join('');
}

function readMarkdownImage(
  text: string,
  index: number,
): { alt: string; url: string; end: number } | null {
  if (text[index] !== '!' || text[index + 1] !== '[') {
    return null;
  }

  const closeBracket = text.indexOf(']', index + 2);
  if (closeBracket === -1 || text[closeBracket + 1] !== '(') {
    return null;
  }

  const closeParen = text.indexOf(')', closeBracket + 2);
  if (closeParen === -1) {
    return null;
  }

  return {
    alt: text.slice(index + 2, closeBracket),
    url: text.slice(closeBracket + 2, closeParen),
    end: closeParen + 1,
  };
}

/** Tokenize a single line of inline markdown without vulnerable regexes. */
export function tokenizeInlineMarkdown(text: string): InlineMarkdownToken[] {
  const tokens: InlineMarkdownToken[] = [];
  let i = 0;

  while (i < text.length) {
    const image = readMarkdownImage(text, i);
    if (image) {
      tokens.push({ type: 'image', alt: image.alt, url: image.url });
      i = image.end;
      continue;
    }

    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        tokens.push({ type: 'bold', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        tokens.push({ type: 'inlineCode', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    let next = i + 1;
    while (next < text.length) {
      if (text[next] === '`') break;
      if (text[next] === '*' && text[next + 1] === '*') break;
      if (text[next] === '!' && text[next + 1] === '[') break;
      next += 1;
    }

    tokens.push({ type: 'text', value: text.slice(i, next) });
    i = next;
  }

  return tokens;
}
