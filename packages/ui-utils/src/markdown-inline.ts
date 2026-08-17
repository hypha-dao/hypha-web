export type InlineMarkdownToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'underline'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'link'; label: string; url: string };

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

export function isSafeInlineLinkUrl(url: string): boolean {
  const href = url.trim();
  if (!href) return false;
  const lower = href.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    try {
      const parsed = new URL(href);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeInlineHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.toLowerCase().startsWith('www.')) {
    const withProtocol = `https://${href}`;
    return isSafeInlineLinkUrl(withProtocol) ? withProtocol : null;
  }
  return isSafeInlineLinkUrl(href) ? href : null;
}

function readMarkdownLink(
  text: string,
  index: number,
): { label: string; url: string; end: number } | null {
  if (text[index] !== '[') return null;
  if (index > 0 && text[index - 1] === '!') return null;
  const closeBracket = text.indexOf(']', index + 1);
  if (closeBracket === -1 || closeBracket === index + 1) return null;
  if (text[closeBracket + 1] !== '(') return null;
  const urlStart = closeBracket + 2;
  let urlEnd = urlStart;
  while (urlEnd < text.length) {
    const ch = text[urlEnd];
    if (ch === '\n' || ch === ')' || ch === ' ' || ch === '\t') break;
    urlEnd += 1;
  }
  if (urlEnd >= text.length || text[urlEnd] !== ')' || urlEnd === urlStart) {
    return null;
  }
  const url = normalizeInlineHref(text.slice(urlStart, urlEnd));
  if (!url) return null;
  return {
    label: text.slice(index + 1, closeBracket),
    url,
    end: urlEnd + 1,
  };
}

function isUrlBoundary(text: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = text[index - 1]!;
  return (
    prev === ' ' ||
    prev === '\t' ||
    prev === '(' ||
    prev === '[' ||
    prev === '<' ||
    prev === '"' ||
    prev === "'"
  );
}

function readBareUrl(
  text: string,
  index: number,
): { raw: string; url: string; end: number } | null {
  if (!isUrlBoundary(text, index)) return null;
  let prefixLen = 0;
  if (text.startsWith('https://', index)) prefixLen = 8;
  else if (text.startsWith('http://', index)) prefixLen = 7;
  else if (text.startsWith('www.', index)) prefixLen = 4;
  else return null;
  let end = index + prefixLen;
  while (end < text.length) {
    const ch = text[end]!;
    if (
      ch === ' ' ||
      ch === '\t' ||
      ch === '<' ||
      ch === '>' ||
      ch === '"' ||
      ch === "'"
    ) {
      break;
    }
    end += 1;
  }
  if (end <= index + prefixLen) return null;
  let raw = text.slice(index, end);
  while (
    raw.length > prefixLen &&
    (raw.endsWith('.') ||
      raw.endsWith(',') ||
      raw.endsWith(';') ||
      raw.endsWith(':') ||
      raw.endsWith('!') ||
      raw.endsWith('?'))
  ) {
    raw = raw.slice(0, -1);
  }
  const url = normalizeInlineHref(raw);
  if (!url) return null;
  return { raw, url, end: index + raw.length };
}

function findClosingDouble(
  text: string,
  openEnd: number,
  delim: string,
): number {
  return text.indexOf(delim, openEnd);
}

function findClosingSingleStar(text: string, openEnd: number): number {
  for (let i = openEnd; i < text.length; i++) {
    if (text[i] === '*' && text[i + 1] !== '*') {
      return i;
    }
  }
  return -1;
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

    const link = readMarkdownLink(text, i);
    if (link) {
      tokens.push({ type: 'link', label: link.label, url: link.url });
      i = link.end;
      continue;
    }

    const bare = readBareUrl(text, i);
    if (bare) {
      tokens.push({ type: 'link', label: bare.raw, url: bare.url });
      i = bare.end;
      continue;
    }

    if (text[i] === '*' && text[i + 1] === '*') {
      const end = findClosingDouble(text, i + 2, '**');
      if (end !== -1) {
        tokens.push({ type: 'bold', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '_' && text[i + 1] === '_') {
      const end = findClosingDouble(text, i + 2, '__');
      if (end !== -1) {
        tokens.push({ type: 'underline', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = findClosingSingleStar(text, i + 1);
      if (end !== -1) {
        tokens.push({ type: 'italic', value: text.slice(i + 1, end) });
        i = end + 1;
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
      if (text[next] === '_' && text[next + 1] === '_') break;
      if (text[next] === '*' && text[next + 1] !== '*') break;
      if (text[next] === '!' && text[next + 1] === '[') break;
      if (text[next] === '[') break;
      if (readBareUrl(text, next)) break;
      next += 1;
    }

    tokens.push({ type: 'text', value: text.slice(i, next) });
    i = next;
  }

  return tokens;
}
