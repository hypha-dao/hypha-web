'use client';

import { scrollMainColumnTo } from '../../common/main-column-scroll';

/** The wallet list and an action share one scroll column. A repeat visit can
 * leave that column past a short form, so the click looks dead. The link stays
 * a client navigation. */
export function prepareWalletActionNavigation() {
  scrollMainColumnTo(0, 'auto');
}
