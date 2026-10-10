'use client';

import {
  clearMainColumnScrollFreeze,
  isMainColumnScrollFrozen,
  releaseMainColumnScrollHeightHold,
  scrollMainColumnTo,
} from '@hypha-platform/epics';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function spaceSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/\/dho\/([^/]+)/);
  return match?.[1] ?? null;
}

export default function ScrollUp() {
  /*
    When clicking a link, user will not scroll to the top of
    the page if the header is sticky. Their current scroll
    position will persist to the next page. This useEffect
    is a workaround to 'fix' that behavior.

    Skip when staying inside the same space — resetting scroll
    on every tab change flickers the cover / sticky banner.
  */

  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const prevSpace = spaceSlugFromPath(prev);
    const nextSpace = spaceSlugFromPath(pathname);
    if (prevSpace && nextSpace && prevSpace === nextSpace) {
      return;
    }
    const mobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches;
    // Desktop space-to-space settles on the banner in the space chrome.
    // A frozen offset there is the handoff, not a stuck page.
    if (prevSpace && nextSpace && !mobile) {
      if (isMainColumnScrollFrozen()) return;
      scrollMainColumnTo(0, 'auto');
      return;
    }
    // Leaving a space, or changing space on a phone: a leftover freeze or
    // height hold keeps the previous offset and paints an empty screen.
    clearMainColumnScrollFreeze();
    releaseMainColumnScrollHeightHold();
    scrollMainColumnTo(0, 'auto');
  }, [pathname]);
  return <></>;
}
