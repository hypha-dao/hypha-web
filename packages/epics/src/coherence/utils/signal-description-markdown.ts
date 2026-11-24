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
  const match = trimmed.match(LABEL_THEN_DASH);
  if (!match) return body;
  const label = match[1]!.trim();
  const rest = match[2]!.trim();
  if (!label || !rest) return body;
  // Keep plain sentences ("Do this - then that" mid-thought) from becoming titles.
  if (/\s{2,}/.test(label) || /[,:;]/.test(label)) return body;
  return `**${label}** – ${rest}`;
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

  const lines = raw.split('\n').map(normalizeItemLine);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = out[out.length - 1];
    const prevPrev = out[out.length - 2];

    // Drop blank lines between consecutive list items so MDX keeps one list.
    if (
      line.trim() === '' &&
      prev !== undefined &&
      isListItem(prev) &&
      i + 1 < lines.length &&
      isListItem(lines[i + 1]!)
    ) {
      continue;
    }

    // Blank line before the first list item when it follows prose.
    if (
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
