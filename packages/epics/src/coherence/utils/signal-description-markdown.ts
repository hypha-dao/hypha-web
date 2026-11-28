/**
 * Prep signal description markdown so detail pages show clear structure:
 * real lists, a break before the first item, and short labels before a dash.
 */

const ESCAPED_ORDERED = /^(\s*)(\d+)\\\.(\s+)(.*)$/;
const ORDERED_ITEM = /^(\s*)(\d+)[.)](\s+)(.*)$/;
const BULLET_ITEM = /^(\s*)([-*+•])(\s+)(.*)$/;
/** "Visual context – …" / "Link to quest - …" — label stays short. */
const LABEL_THEN_DASH = /^(.{1,48}?)(?:\s+[–—]\s+|\s+-\s+)(.+)$/;

function emphasizeListLabel(body: string): string {
  const trimmed = body.trim();
  if (!trimmed || trimmed.includes('**')) return body;
  const urlLabel = trimmed.match(/^(.{1,60}?):\s+(https?:\/\/\S+)$/);
  if (urlLabel) {
    const label = urlLabel[1]!.trim();
    const url = urlLabel[2]!.trim();
    if (label && url && !/[.;]/.test(label)) return `**${label}:** ${url}`;
  }
  const match = trimmed.match(LABEL_THEN_DASH);
  if (!match) return body;
  const label = match[1]!.trim();
  const rest = match[2]!.trim();
  if (!label || !rest) return body;
  // Keep plain sentences ("Do this - then that" mid-thought) from becoming titles.
  if (/\s{2,}/.test(label) || /[,:;]/.test(label)) return body;
  return `**${label}** – ${rest}`;
}

/** A line that is only a bold label, the way the editor stores a section title. */
const SOLO_BOLD = /^\*\*([^*\n]+)\*\*$/;

function promoteSoloBold(line: string): string {
  const match = line.trim().match(SOLO_BOLD);
  const title = match?.[1]?.trim();
  if (!title || title.length > 80) return line;
  return `### ${title}`;
}

function linkBareUrls(line: string): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end === -1) return out + line.slice(i);
      out += line.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const http =
      line.startsWith('https://', i) || line.startsWith('http://', i);
    if (!http) {
      out += line[i];
      i += 1;
      continue;
    }
    const prev = i > 0 ? line[i - 1] : '';
    if (prev === '(' || prev === '<') {
      const close = prev === '(' ? ')' : '>';
      const end = line.indexOf(close, i);
      const stop = end === -1 ? line.length : end;
      out += line.slice(i, stop);
      i = stop;
      continue;
    }
    let end = i;
    while (end < line.length && !/\s/.test(line[end]!)) end += 1;
    let url = line.slice(i, end);
    const punct = url.match(/[.,;:!?]+$/);
    const tail = punct?.[0] ?? '';
    if (tail) url = url.slice(0, -tail.length);
    out +=
      url.length > 'https://x'.length ? `[${url}](${url})${tail}` : url + tail;
    i = end;
  }
  return out;
}

function normalizeItemLine(line: string): string {
  const unescaped = line.replace(ESCAPED_ORDERED, '$1$2.$3$4');
  const ordered = unescaped.match(ORDERED_ITEM);
  if (ordered) {
    return `${ordered[1]}${ordered[2]}.${ordered[3]}${emphasizeListLabel(
      ordered[4]!,
    )}`;
  }
  const bullet = unescaped.match(BULLET_ITEM);
  if (bullet) {
    return `${bullet[1]}-${bullet[3]}${emphasizeListLabel(bullet[4]!)}`;
  }
  return unescaped;
}

function isListItem(line: string): boolean {
  return ORDERED_ITEM.test(line) || BULLET_ITEM.test(line);
}

/**
 * Turn loosely typed numbered/bulleted paragraphs into markdown the detail
 * renderer can structure: tight lists, intro separated, labels emphasized.
 */
export function prepareSignalDescriptionMarkdown(source: string): string {
  const raw = source.replace(/\r\n/g, '\n').trim();
  if (!raw) return '';

  let inFence = false;
  const lines = raw.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return { text: line, literal: true };
    }
    // Indented code is literal. Nested lists use fewer than four spaces.
    if (inFence || /^(?: {4}|\t)/.test(line)) {
      return { text: line, literal: true };
    }
    const item = normalizeItemLine(line);
    const titled = isListItem(item) ? item : promoteSoloBold(item);
    return { text: linkBareUrls(titled), literal: false };
  });
  const out: string[] = [];
  const itemAt = (index: number) => {
    const line = lines[index];
    return !!line && !line.literal && isListItem(line.text);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.text;
    const prev = out[out.length - 1];
    const prevPrev = out[out.length - 2];
    const literal = lines[i]!.literal;

    // Drop blank lines between consecutive list items so MDX keeps one list.
    if (
      !literal &&
      line.trim() === '' &&
      prev !== undefined &&
      isListItem(prev) &&
      itemAt(i + 1)
    ) {
      continue;
    }

    // Blank line before the first list item when it follows prose.
    if (
      !literal &&
      isListItem(line) &&
      prev !== undefined &&
      prev.trim() !== '' &&
      !isListItem(prev) &&
      prevPrev !== ''
    ) {
      out.push('');
    }

    out.push(line);
  }

  return out.join('\n').trim();
}
