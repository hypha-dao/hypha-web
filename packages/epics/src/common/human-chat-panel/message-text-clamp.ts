/**
 * Slack before a clamped message body counts as truncated.
 * Matches the previous `scrollHeight > clientHeight + 1` check.
 */
const CLAMP_OVERFLOW_SLACK_PX = 1;

/**
 * The unclamped copy can disagree by a couple of pixels. A real extra line
 * is the body line-height (13px × 1.35).
 */
const UNCLAMPED_OVERFLOW_SLACK_PX = 8;

export function stripLineClampClasses(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token.length > 0 && !token.startsWith('line-clamp-'))
    .join(' ');
}

/**
 * True when a line-clamped message body is taller than the box the reader sees.
 *
 * Chromium reports the full `scrollHeight` under `-webkit-line-clamp`, so the
 * first comparison is enough there. WebKit (iPhone Safari) reports
 * `scrollHeight === clientHeight` for a clamped box, which hid Read more.
 * `unclampedHeight` is the same node measured with the clamp removed.
 */
export function clampedMessageBodyOverflows(input: {
  clientWidth: number;
  clientHeight: number;
  scrollHeight: number;
  unclampedHeight: number;
}): boolean {
  if (!(input.clientWidth > 0) || !(input.clientHeight > 0)) return false;
  if (input.scrollHeight > input.clientHeight + CLAMP_OVERFLOW_SLACK_PX) {
    return true;
  }
  return (
    input.unclampedHeight > input.clientHeight + UNCLAMPED_OVERFLOW_SLACK_PX
  );
}

function visibleClientHeight(el: HTMLElement): number {
  if (el.clientHeight > 0) return el.clientHeight;
  return el.offsetHeight;
}

/**
 * Height of `el` with `line-clamp-*` removed.
 * The copy is measured on `document.body` so a tall probe cannot move the
 * chat scroller (the panel sits inside a transformed sidebar).
 */
export function measureUnclampedMessageBodyHeight(el: HTMLElement): number {
  const width = el.clientWidth;
  if (!(width > 0) || typeof document === 'undefined' || !document.body) {
    return 0;
  }
  const clone = el.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return 0;

  const computed = getComputedStyle(el);
  clone.className = stripLineClampClasses(el.className);
  clone.removeAttribute('id');
  clone.removeAttribute('data-testid');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('data-message-clamp-measure', '');
  clone.style.display = 'block';
  clone.style.overflow = 'visible';
  clone.style.width = `${width}px`;
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.minHeight = '0';
  clone.style.boxSizing = 'border-box';
  clone.style.whiteSpace = computed.whiteSpace;
  clone.style.fontFamily = computed.fontFamily;
  clone.style.fontSize = computed.fontSize;
  clone.style.fontWeight = computed.fontWeight;
  clone.style.fontStyle = computed.fontStyle;
  clone.style.lineHeight = computed.lineHeight;
  clone.style.letterSpacing = computed.letterSpacing;
  clone.style.wordBreak = computed.wordBreak;
  clone.style.overflowWrap = computed.overflowWrap;
  clone.style.padding = computed.padding;
  clone.style.border = '0';
  clone.style.setProperty('-webkit-line-clamp', 'unset');
  clone.style.setProperty('-webkit-box-orient', 'unset');

  const sandbox = document.createElement('div');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '0';
  sandbox.style.top = '0';
  sandbox.style.visibility = 'hidden';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.zIndex = '-1';
  sandbox.style.width = `${width}px`;
  sandbox.style.margin = '0';
  sandbox.style.padding = '0';
  sandbox.style.overflow = 'visible';
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);
  try {
    return clone.scrollHeight;
  } finally {
    sandbox.remove();
  }
}

export function messageBodyCanExpand(
  el: HTMLElement,
  measureUnclamped: (
    node: HTMLElement,
  ) => number = measureUnclampedMessageBodyHeight,
): boolean {
  const clientWidth = el.clientWidth;
  const clientHeight = visibleClientHeight(el);
  const scrollHeight = el.scrollHeight;
  if (!(clientWidth > 0) || !(clientHeight > 0)) return false;
  const fastPathOverflows =
    scrollHeight > clientHeight + CLAMP_OVERFLOW_SLACK_PX;
  return clampedMessageBodyOverflows({
    clientWidth,
    clientHeight,
    scrollHeight,
    unclampedHeight: fastPathOverflows ? 0 : measureUnclamped(el),
  });
}
