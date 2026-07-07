export const SIGNAL_SLUG_SELECTOR_ATTR = 'data-signal-slug';

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

export function highlightSignalCardElement(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
  el.classList.add('ring-2', 'ring-primary', 'rounded-xl', 'transition-shadow');
  window.setTimeout(() => {
    el.classList.remove(
      'ring-2',
      'ring-primary',
      'rounded-xl',
      'transition-shadow',
    );
  }, 2400);
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
