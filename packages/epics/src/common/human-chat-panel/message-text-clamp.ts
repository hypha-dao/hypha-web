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
 * Either signal is enough: Chromium's `scrollHeight`, or the height of a copy
 * with the clamp removed. WebKit can report both as equal until layout
 * settles, so callers must measure again after that.
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

function scheduleSettledFrames(run: () => void, pending: Set<number>): void {
  const outer = requestAnimationFrame(() => {
    pending.delete(outer);
    run();
    const inner = requestAnimationFrame(() => {
      pending.delete(inner);
      run();
    });
    pending.add(inner);
  });
  pending.add(outer);
}

/**
 * Hidden unclamped copy. Its border box grows with the text, so a
 * ResizeObserver on it fires when the clamped box stays at 10 lines.
 */
function attachUnclampedProbe(
  el: HTMLElement,
  onResize: () => void,
): { sync: () => void; disconnect: () => void } {
  const probe = document.createElement('div');
  probe.setAttribute('data-message-clamp-probe', '');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'fixed';
  probe.style.left = '0';
  probe.style.top = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.zIndex = '-1';
  probe.style.display = 'block';
  probe.style.overflow = 'visible';
  probe.style.height = 'auto';
  probe.style.maxHeight = 'none';
  probe.style.margin = '0';
  probe.style.setProperty('-webkit-line-clamp', 'unset');
  probe.style.setProperty('-webkit-box-orient', 'unset');
  document.body.appendChild(probe);

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => onResize());
  observer?.observe(probe);

  const sync = () => {
    const width = el.clientWidth;
    if (!(width > 0)) return;
    const computed = getComputedStyle(el);
    probe.className = stripLineClampClasses(el.className);
    probe.style.width = `${width}px`;
    probe.style.boxSizing = 'border-box';
    probe.style.whiteSpace = computed.whiteSpace;
    probe.style.fontFamily = computed.fontFamily;
    probe.style.fontSize = computed.fontSize;
    probe.style.fontWeight = computed.fontWeight;
    probe.style.lineHeight = computed.lineHeight;
    probe.style.wordBreak = computed.wordBreak;
    probe.style.overflowWrap = computed.overflowWrap;
    probe.innerHTML = el.innerHTML;
  };

  return {
    sync,
    disconnect: () => {
      observer?.disconnect();
      probe.remove();
    },
  };
}

function whenDocumentFontsSettle(onSettle: () => void): () => void {
  const fonts = document.fonts;
  if (!fonts) return () => {};
  let cancelled = false;
  const run = () => {
    if (!cancelled) onSettle();
  };
  void fonts.ready?.then(run).catch(() => {});
  const onDone = () => run();
  if (typeof fonts.addEventListener === 'function') {
    fonts.addEventListener('loadingdone', onDone);
  }
  return () => {
    cancelled = true;
    if (typeof fonts.removeEventListener === 'function') {
      fonts.removeEventListener('loadingdone', onDone);
    }
  };
}

/**
 * Report whether a clamped message body overflows, including after WebKit
 * updates `scrollHeight` without resizing the clamped box.
 *
 * The first read often happens in `useLayoutEffect`, before line-clamp
 * overflow, fonts, or mention text have settled. The clamped border box can
 * already be 10 lines tall, so a ResizeObserver on that box never fires again.
 */
export function watchClampedMessageBody(
  el: HTMLElement,
  onChange: (overflows: boolean) => void,
): () => void {
  let cancelled = false;
  const pendingFrames = new Set<number>();
  const probe = attachUnclampedProbe(el, () => measure());

  function measure() {
    if (cancelled || !el.isConnected) return;
    onChange(messageBodyCanExpand(el));
  }

  const settle = () => {
    if (cancelled) return;
    probe.sync();
    measure();
    scheduleSettledFrames(() => {
      if (cancelled) return;
      probe.sync();
      measure();
    }, pendingFrames);
  };

  settle();

  const boxObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => settle());
  boxObserver?.observe(el);
  if (el.parentElement) boxObserver?.observe(el.parentElement);

  const mutations = new MutationObserver(() => settle());
  mutations.observe(el, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  const stopFonts = whenDocumentFontsSettle(settle);

  return () => {
    cancelled = true;
    for (const id of pendingFrames) cancelAnimationFrame(id);
    pendingFrames.clear();
    boxObserver?.disconnect();
    mutations.disconnect();
    stopFonts();
    probe.disconnect();
  };
}
