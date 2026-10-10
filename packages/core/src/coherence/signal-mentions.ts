export const SIGNAL_PERSON_MENTION_HREF_PREFIX = '/profile/';

export type SignalPersonMention = {
  slug: string;
  label: string;
  href: string;
};

export type SignalMentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; mention: SignalPersonMention };

function normalizePersonSlug(slug: string): string {
  let value = slug.trim();
  while (value.startsWith('/')) value = value.slice(1);
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function isTwoLetterLocale(value: string): boolean {
  if (value.length !== 2) return false;
  const a = value.charCodeAt(0);
  const b = value.charCodeAt(1);
  return a >= 97 && a <= 122 && b >= 97 && b <= 122;
}

function slugFromMentionHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('hypha-person:')) {
    const slug = normalizePersonSlug(trimmed.slice('hypha-person:'.length));
    return slug || null;
  }
  const path = trimmed.startsWith('http')
    ? (() => {
        try {
          return new URL(trimmed).pathname;
        } catch {
          return trimmed;
        }
      })()
    : trimmed;
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts.length === 2 && parts[0] === 'profile') {
    return normalizePersonSlug(decodeURIComponent(parts[1] ?? '')) || null;
  }
  if (
    parts.length === 3 &&
    isTwoLetterLocale(parts[0] ?? '') &&
    parts[1] === 'profile'
  ) {
    return normalizePersonSlug(decodeURIComponent(parts[2] ?? '')) || null;
  }
  return null;
}

function visitMentionLinks(
  text: string,
  onMatch: (start: number, end: number, label: string, slug: string) => void,
) {
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('[@', index);
    if (start < 0) return;
    const mid = text.indexOf('](', start + 2);
    if (mid < 0) {
      index = start + 2;
      continue;
    }
    const end = text.indexOf(')', mid + 2);
    if (end < 0) {
      index = start + 2;
      continue;
    }
    const label = text.slice(start + 2, mid);
    const href = text.slice(mid + 2, end);
    const slug = slugFromMentionHref(href);
    if (slug && !label.includes('\n')) {
      onMatch(start, end + 1, label.trim(), slug);
    }
    index = end + 1;
  }
}

export function personProfileHref(slug: string, lang?: string): string {
  const normalized = normalizePersonSlug(slug);
  if (!normalized) return '';
  return lang
    ? `/${lang}${SIGNAL_PERSON_MENTION_HREF_PREFIX}${encodeURIComponent(
        normalized,
      )}`
    : `${SIGNAL_PERSON_MENTION_HREF_PREFIX}${encodeURIComponent(normalized)}`;
}

export function mentionMarkdown(label: string, slug: string): string {
  const safeLabel = label.trim() || slug.trim();
  return `[@${safeLabel}](${personProfileHref(slug)})`;
}

export function parseSignalMentions(
  text: string | null | undefined,
): SignalPersonMention[] {
  if (!text) return [];
  const seen = new Set<string>();
  const mentions: SignalPersonMention[] = [];
  visitMentionLinks(text, (_start, _end, label, slug) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    mentions.push({
      slug,
      label: label || slug,
      href: personProfileHref(slug),
    });
  });
  return mentions;
}

export function splitSignalMentionText(text: string): SignalMentionSegment[] {
  if (!text) return [];
  const segments: SignalMentionSegment[] = [];
  let cursor = 0;
  visitMentionLinks(text, (start, end, label, slug) => {
    if (start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, start) });
    }
    segments.push({
      type: 'mention',
      mention: {
        slug,
        label: label || slug,
        href: personProfileHref(slug),
      },
    });
    cursor = end;
  });
  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }
  return segments;
}

export function newlyMentionedSlugs(
  previousText: string | null | undefined,
  nextText: string | null | undefined,
): string[] {
  const previous = new Set(
    parseSignalMentions(previousText).map((mention) => mention.slug),
  );
  return parseSignalMentions(nextText)
    .map((mention) => mention.slug)
    .filter((slug) => !previous.has(slug));
}

export function isPersonProfileHref(href: string): boolean {
  return slugFromMentionHref(href) != null;
}
