export const SIGNAL_SLUG_SELECTOR_ATTR = 'data-signal-slug';

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
