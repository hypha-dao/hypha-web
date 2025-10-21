'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function ScrollUp() {
  /*
    When clicking a link, user will not scroll to the top of
    the page if the header is sticky. Their current scroll
    position will persist to the next page. This useEffect
    is a workaround to 'fix' that behavior.
  */

  const pathname = usePathname();
  useEffect(() => {
    window.scroll(0, 0);
  }, [pathname]);
  return <></>;
}
