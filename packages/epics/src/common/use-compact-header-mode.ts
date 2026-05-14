'use client';

import { useEffect, useState } from 'react';

const COMPACT_ATTR = 'data-compact-header';

function readCompactHeaderMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(COMPACT_ATTR) === 'true';
}

export function useCompactHeaderMode(): boolean {
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    readCompactHeaderMode(),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsCompact(readCompactHeaderMode());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [COMPACT_ATTR],
    });
    return () => observer.disconnect();
  }, []);

  return isCompact;
}
