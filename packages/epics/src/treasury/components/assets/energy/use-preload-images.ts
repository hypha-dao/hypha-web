'use client';

import * as React from 'react';

/** Warm the browser image cache for avatar URLs used across Energy tabs. */
export const usePreloadImages = (urls: readonly string[]) => {
  const serialized = React.useMemo(
    () => [...new Set(urls.filter(Boolean))].sort().join('\0'),
    [urls],
  );

  React.useEffect(() => {
    if (!serialized) return;
    for (const url of serialized.split('\0')) {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
    }
  }, [serialized]);
};
