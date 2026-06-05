'use client';

import { useEffect, useState } from 'react';

const PANEL_COMPACT_ATTR = 'data-compact-panels';

function readCompactPanelsMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(PANEL_COMPACT_ATTR) === 'true';
}

/** True when side panels use compact/full-width layout (see PanelWrapLayout). */
export function useCompactPanelsMode(): boolean {
  const [isCompactPanels, setIsCompactPanels] = useState<boolean>(() =>
    readCompactPanelsMode(),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsCompactPanels(readCompactPanelsMode());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [PANEL_COMPACT_ATTR],
    });
    return () => observer.disconnect();
  }, []);

  return isCompactPanels;
}
