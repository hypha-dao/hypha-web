export const SIGNAL_PERSON_MENTION_HREF_PREFIX = '/profile/';

export type SignalPersonMention = {
  slug: string;
  label: string;
  href: string;
};

const MENTION_MARKDOWN_RE =
  /\[@([^\]]+)\]\((?:(?:\/[a-z]{2})?\/profile\/|hypha-person:)([^)\s]+)\)/gi;

function normalizePersonSlug(slug: string): string {
  return slug.trim().replace(/^\/+|\/+$/g, '');
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
  for (const match of text.matchAll(MENTION_MARKDOWN_RE)) {
    const label = match[1]?.trim() ?? '';
    const slug = normalizePersonSlug(match[2] ?? '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    mentions.push({
      slug,
      label: label || slug,
      href: personProfileHref(slug),
    });
  }
  return mentions;
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
  try {
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    return /^(?:\/[a-z]{2})?\/profile\/[^/]+$/.test(path);
  } catch {
    return href.startsWith('hypha-person:');
  }
}
