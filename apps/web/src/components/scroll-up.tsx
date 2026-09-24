'use client';

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

    window?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return <></>;
}
