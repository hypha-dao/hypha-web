'use client';

import * as React from 'react';

/** True on touch-first devices (phones, tablets) where fine pointer is unavailable. */
export function usePrefersCoarsePointer(): boolean | undefined {
  const [coarse, setCoarse] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const onChange = () => {
      setCoarse(mql.matches);
    };
    mql.addEventListener('change', onChange);
    setCoarse(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return coarse;
}
