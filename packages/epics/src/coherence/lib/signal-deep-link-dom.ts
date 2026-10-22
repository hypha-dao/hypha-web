export const SIGNAL_SLUG_SELECTOR_ATTR = 'data-signal-slug';

export type SignalDeepLinkChoiceInput = {
  humanChatEnabled: boolean;
  chatSlug: string | null;
  urlSlug: string | null;
  /** `undefined` until this picker has seen one render. */
  previousChatSlug: string | null | undefined;
  previousUrlSlug: string | null | undefined;
  previousChoice: string | null;
};

/**
 * Which signal should be open.
 * A new `?signal=` wins over a chat that is already open, so clicking a second
 * card replaces the first. A chat that just changed still wins over a URL that
 * has not caught up, so the address bar does not flash the previous signal.
 */
export function pickSignalDeepLinkTarget({
  humanChatEnabled,
  chatSlug,
  urlSlug,
  previousChatSlug,
  previousUrlSlug,
  previousChoice,
}: SignalDeepLinkChoiceInput): string | null {
  const chat = chatSlug?.trim() || null;
  const url = urlSlug?.trim() || null;
  if (!humanChatEnabled || !chat) return url;
  if (!url || url === chat) return chat;

  const hadPrevious =
    previousChatSlug !== undefined || previousUrlSlug !== undefined;
  const urlMoved = hadPrevious && url !== (previousUrlSlug?.trim() || null);
  const chatMoved = hadPrevious && chat !== (previousChatSlug?.trim() || null);

  if (chatMoved && !urlMoved) return chat;
  if (urlMoved && !chatMoved) return url;
  if (!hadPrevious) return url;

  const previous = previousChoice?.trim() || null;
  if (previous === url || previous === chat) return previous;
  return url;
}

/** True when the open chat should be written into `?signal=`. */
export function shouldWriteOpenChatToSignalUrl(
  choice: string | null,
  chatSlug: string | null,
  urlSlug: string | null,
): boolean {
  const chat = chatSlug?.trim() || null;
  const url = urlSlug?.trim() || null;
  if (!chat || choice !== chat) return false;
  return url !== chat;
}

/** Live `?signal=` — `useSearchParams()` can lag behind `history.replaceState`. */
export function readLiveSignalSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    new URLSearchParams(window.location.search).get('signal')?.trim() ?? null
  );
}

export function escapeCssSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function findSignalCardElement(slug: string): HTMLElement | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const escaped = escapeCssSelector(trimmed);
  return document.querySelector(
    `[${SIGNAL_SLUG_SELECTOR_ATTR}="${escaped}"]`,
  ) as HTMLElement | null;
}

export function scrollSignalCardElementIntoView(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
}

/** Scroll only — persistent accent selection is applied in React via {@link signalCardActiveClass}. */
export function highlightSignalCardElement(el: HTMLElement): void {
  scrollSignalCardElementIntoView(el);
}

export function getSignalSlugDomProps(
  slug?: string | null,
): Record<string, string> {
  const trimmed = slug?.trim();
  if (!trimmed) return {};
  return { [SIGNAL_SLUG_SELECTOR_ATTR]: trimmed };
}

/** Retry locating a signal card until the coherence view has rendered. */
export function scrollToSignalCardWithRetry(
  slug: string,
  options?: { maxAttempts?: number; onFound?: (el: HTMLElement) => void },
): () => void {
  let cancelled = false;
  let attempts = 0;
  const maxAttempts = options?.maxAttempts ?? 120;
  let found = false;

  const tryLocate = () => {
    if (cancelled || found) return;
    attempts += 1;
    const el = findSignalCardElement(slug);
    if (el) {
      found = true;
      highlightSignalCardElement(el);
      options?.onFound?.(el);
      return;
    }
    if (attempts < maxAttempts) {
      window.requestAnimationFrame(tryLocate);
    }
  };

  window.requestAnimationFrame(tryLocate);
  return () => {
    cancelled = true;
  };
}
