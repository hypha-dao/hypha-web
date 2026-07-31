'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

/**
 * When `enableSystem` is false, a previously stored `theme=system` from localStorage
 * would leave next-themes in an inconsistent state. Normalize to `light` on the client.
 */
export function ThemeStorageNormalize() {
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    if (theme === 'system') {
      setTheme('light');
    }
  }, [theme, setTheme]);

  return null;
}
