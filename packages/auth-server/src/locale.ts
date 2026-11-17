/** Cookie that remembers the language chosen with `?lang=` between the login and consent pages. */
export const AUTH_SERVER_LANG_COOKIE = 'hypha_as_lang';

/** Language tags that map onto a supported locale although their primary subtag differs. */
const ALIASES: Record<string, string> = { nb: 'no', nn: 'no' };

function toSupported(
  tag: string | null | undefined,
  supported: readonly string[],
): string | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  const mapped = ALIASES[primary] ?? primary;
  return supported.includes(mapped) ? mapped : null;
}

/** Tags of an Accept-Language header, best first (by q, then by position). */
function acceptedTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const weight = q === undefined ? 1 : Number(q);
      return { tag: tag?.trim() ?? '', weight, index };
    })
    .filter(
      (t) =>
        t.tag && t.tag !== '*' && Number.isFinite(t.weight) && t.weight > 0,
    )
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((t) => t.tag);
}

/**
 * The language of the login and consent pages. One path serves everyone, so the language comes
 * from the person, in this order: an explicit `?lang=`, the cookie that remembers it, the browser's
 * Accept-Language, then the default. Unsupported values are ignored, never echoed.
 */
export function resolveAuthLocale(input: {
  lang?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  supported: readonly string[];
  fallback: string;
}): { locale: string; fromParam: boolean } {
  const { supported, fallback } = input;
  const fromParam = toSupported(input.lang, supported);
  if (fromParam) return { locale: fromParam, fromParam: true };
  const fromCookie = toSupported(input.cookie, supported);
  if (fromCookie) return { locale: fromCookie, fromParam: false };
  for (const tag of acceptedTags(input.acceptLanguage)) {
    const match = toSupported(tag, supported);
    if (match) return { locale: match, fromParam: false };
  }
  return { locale: fallback, fromParam: false };
}
