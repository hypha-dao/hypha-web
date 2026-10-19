'use client';

import { scrollMainColumnTo } from '../../common/main-column-scroll';

function currentHref() {
  return `${window.location.pathname}${window.location.search}`;
}

let fallbackTimer = 0;

/** The wallet list and the send page share one scroll column. A repeat visit
 * can leave that column past the short form, so the click looks dead. */
export function prepareWalletActionNavigation(href: string) {
  scrollMainColumnTo(0, 'auto');
  if (typeof window === 'undefined') return;

  const target = new URL(href, window.location.href);
  const want = `${target.pathname}${target.search}`;
  window.clearTimeout(fallbackTimer);
  if (currentHref() === want) return;

  fallbackTimer = window.setTimeout(() => {
    if (currentHref() === want) {
      scrollMainColumnTo(0, 'auto');
      return;
    }
    window.location.assign(want);
  }, 1200);
}
