/**
 * Heuristic: does plaintext look like Markdown worth parsing on paste?
 * Conservative — avoid hijacking normal prose, single URLs, or short fragments.
 *
 * Implemented with linear string scans (no quantified character-class regex on
 * untrusted paste input) to avoid ReDoS / CodeQL polynomial-regex findings.
 */

function isWhitespace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

function startsWithHeading(line: string, maxLevel = 4): boolean {
  let i = 0;
  while (i < line.length && i < maxLevel && line[i] === '#') i += 1;
  if (i === 0 || i > maxLevel) return false;
  return line[i] === ' ' && i + 1 < line.length && !isWhitespace(line[i + 1]);
}

function startsWithBlockquote(line: string): boolean {
  if (line[0] !== '>') return false;
  return line.length === 1 || line[1] === ' ' || !isWhitespace(line[1]);
}

function startsWithFence(line: string): boolean {
  if (line.startsWith('```') || line.startsWith('~~~')) return true;
  return false;
}

function leadingSpaces(line: string): number {
  let i = 0;
  while (i < 3 && i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i += 1;
  }
  return i;
}

function startsWithTaskList(line: string): boolean {
  let i = leadingSpaces(line);
  const bullet = line[i];
  if (bullet !== '-' && bullet !== '*' && bullet !== '+') return false;
  i += 1;
  if (line[i] !== ' ') return false;
  i += 1;
  if (line[i] !== '[') return false;
  const mark = line[i + 1];
  if (mark !== ' ' && mark !== 'x' && mark !== 'X') return false;
  if (line[i + 2] !== ']') return false;
  i += 3;
  if (line[i] !== ' ') return false;
  i += 1;
  return i < line.length && !isWhitespace(line[i]);
}

function startsWithUnorderedList(line: string): boolean {
  let i = leadingSpaces(line);
  const bullet = line[i];
  if (bullet !== '-' && bullet !== '*' && bullet !== '+') return false;
  i += 1;
  if (line[i] !== ' ') return false;
  i += 1;
  return i < line.length && !isWhitespace(line[i]);
}

function startsWithOrderedList(line: string): boolean {
  let i = leadingSpaces(line);
  if (i >= line.length || line[i]! < '0' || line[i]! > '9') return false;
  while (i < line.length && line[i]! >= '0' && line[i]! <= '9') i += 1;
  if (line[i] !== '.') return false;
  i += 1;
  if (line[i] !== ' ') return false;
  i += 1;
  return i < line.length && !isWhitespace(line[i]);
}

/** True if `text` contains a complete `open…close` pair with non-empty inner. */
function hasDelimitedPair(
  text: string,
  open: string,
  close: string = open,
): boolean {
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(open, i);
    if (start === -1) return false;
    const innerStart = start + open.length;
    if (innerStart >= text.length) return false;
    const end = text.indexOf(close, innerStart);
    if (end === -1) return false;
    if (end > innerStart && !text.slice(innerStart, end).includes('\n')) {
      return true;
    }
    i = start + 1;
  }
  return false;
}

/** Single-asterisk italic: `*word*` but not `**`. */
function hasItalicPair(text: string): boolean {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '*') {
      i += 1;
      continue;
    }
    if (text[i + 1] === '*') {
      i += 2;
      continue;
    }
    const innerStart = i + 1;
    let j = innerStart;
    while (j < text.length) {
      if (text[j] === '\n') break;
      if (text[j] === '*' && text[j + 1] !== '*') {
        if (j > innerStart) return true;
        break;
      }
      j += 1;
    }
    i += 1;
  }
  return false;
}

/**
 * Markdown link `[label](url)` without quantified character-class regex.
 * Stops at newlines; requires non-empty label and URL without spaces.
 */
function hasMarkdownLink(text: string): boolean {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '[') {
      i += 1;
      continue;
    }
    // Skip image markers `![...](...)`.
    if (i > 0 && text[i - 1] === '!') {
      i += 1;
      continue;
    }
    const labelStart = i + 1;
    let labelEnd = labelStart;
    while (labelEnd < text.length) {
      const ch = text[labelEnd];
      if (ch === '\n' || ch === ']') break;
      labelEnd += 1;
    }
    if (
      labelEnd >= text.length ||
      text[labelEnd] !== ']' ||
      labelEnd === labelStart
    ) {
      i += 1;
      continue;
    }
    if (text[labelEnd + 1] !== '(') {
      i += 1;
      continue;
    }
    const urlStart = labelEnd + 2;
    let urlEnd = urlStart;
    while (urlEnd < text.length) {
      const ch = text[urlEnd];
      if (ch === '\n' || ch === ')' || ch === ' ' || ch === '\t') break;
      urlEnd += 1;
    }
    if (urlEnd < text.length && text[urlEnd] === ')' && urlEnd > urlStart) {
      return true;
    }
    i += 1;
  }
  return false;
}

function isBareHttpUrl(text: string): boolean {
  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (isWhitespace(text[i])) return false;
  }
  return true;
}

export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.length < 2) return false;

  if (isBareHttpUrl(trimmed)) return false;

  const lines = trimmed.split(/\r?\n/);
  let structuralHits = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (startsWithHeading(line)) {
      structuralHits += 2;
      continue;
    }
    if (startsWithBlockquote(line)) {
      structuralHits += 1;
      continue;
    }
    if (startsWithFence(line)) {
      structuralHits += 2;
      continue;
    }
    if (startsWithTaskList(line)) {
      structuralHits += 2;
      continue;
    }
    if (startsWithUnorderedList(line) || startsWithOrderedList(line)) {
      structuralHits += 1;
      continue;
    }
  }

  if (structuralHits >= 1 && lines.length >= 2) return true;
  if (structuralHits >= 2) return true;

  if (hasDelimitedPair(trimmed, '**')) return true;
  if (hasItalicPair(trimmed)) return true;
  if (hasDelimitedPair(trimmed, '__')) return true;
  if (hasMarkdownLink(trimmed)) return true;
  if (
    hasDelimitedPair(trimmed, '`') &&
    (trimmed.includes('\n') || trimmed.includes('*'))
  ) {
    return true;
  }

  if (lines.length === 1) {
    const line = lines[0]!.trim();
    if (startsWithHeading(line)) return true;
    if (
      (startsWithUnorderedList(line) || startsWithOrderedList(line)) &&
      line.length > 4
    ) {
      return true;
    }
  }

  return false;
}
