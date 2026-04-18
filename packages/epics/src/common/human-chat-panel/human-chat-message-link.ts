/**
 * In-app Human Chat deep links for the DHO space route (`/[lang]/dho/[slug]`).
 * Query: `?chat=<matrixRoomId>&msg=<matrixEventId>` — handled by HumanRightPanel.
 */

/** Match `/en/dho/my-space/...` — captures locale + space slug. */
const DHO_SPACE_PATH_RE = /^\/([^/]+)\/dho\/([^/]+)/;

export function buildHyphaChatMessageUrl(
  pathname: string,
  roomId: string,
  messageId: string,
): string | null {
  const m = pathname.match(DHO_SPACE_PATH_RE);
  if (!m) return null;
  const lang = m[1];
  const slug = m[2];
  const qs = `chat=${encodeURIComponent(roomId)}&msg=${encodeURIComponent(
    messageId,
  )}`;
  if (typeof window === 'undefined') {
    return `/${lang}/dho/${slug}?${qs}`;
  }
  return `${window.location.origin}/${lang}/dho/${slug}?${qs}`;
}

/** Short label after `#` for Discord-style link preview (space slug from URL). */
export function chatLinkChannelLabelFromPathname(
  pathname: string,
): string | null {
  const m = pathname.match(/^\/[^/]+\/dho\/([^/]+)/);
  return m?.[1] ?? null;
}
