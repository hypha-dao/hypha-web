/**
 * In-app Human Chat deep links for the DHO space route (`/[lang]/dho/[slug]`).
 * Short form: `?msg=<matrixEventId>` when opened on the same space (current room).
 * Legacy: `?chat=<roomId>&msg=<eventId>` still supported for cross-room pointers.
 */

/** Match `/en/dho/my-space/...` — captures locale + space slug. */
const DHO_SPACE_PATH_RE = /^\/([^/]+)\/dho\/([^/]+)/;

/**
 * Shareable link to highlight one chat message. Uses **short** query (`msg` only)
 * so copied URLs are smaller; HumanRightPanel resolves using the active space room.
 */
export function buildHyphaChatMessageUrl(
  pathname: string,
  _roomId: string,
  messageId: string,
): string | null {
  const m = pathname.match(DHO_SPACE_PATH_RE);
  if (!m) return null;
  const lang = m[1];
  const slug = m[2];
  const qs = `msg=${encodeURIComponent(messageId)}`;
  if (typeof window === 'undefined') {
    return `/${lang}/dho/${slug}?${qs}`;
  }
  return `${window.location.origin}/${lang}/dho/${slug}?${qs}`;
}

/** True for Hypha DHO URLs that point at a specific Matrix message (timeline deep link). */
export function isHyphaDhoChatMessageUrl(href: string): boolean {
  try {
    const u = new URL(href);
    const hostOk =
      u.hostname === 'localhost' || u.hostname.endsWith('hypha.earth');
    if (!hostOk) return false;
    if (!/\/[^/]+\/dho\/[^/]+/.test(u.pathname)) return false;
    return u.searchParams.has('msg');
  } catch {
    return false;
  }
}

/** Space slug from a Hypha DHO URL path (`/en/dho/treespace/...` → `treespace`). */
export function hyphaDhoSlugFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const m = u.pathname.match(/\/[^/]+\/dho\/([^/]+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Short label after `#` for Discord-style link preview (space slug from URL). */
export function chatLinkChannelLabelFromPathname(
  pathname: string,
): string | null {
  const m = pathname.match(/^\/[^/]+\/dho\/([^/]+)/);
  return m?.[1] ?? null;
}
