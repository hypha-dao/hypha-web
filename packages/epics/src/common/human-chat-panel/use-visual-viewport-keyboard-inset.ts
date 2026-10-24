'use client';

import { useEffect, useState } from 'react';

import { visualViewportKeyboardInset } from './visual-viewport-keyboard';

/** Pixels of the layout viewport covered by the keyboard / visualViewport. */
export function useVisualViewportKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setInset(
        visualViewportKeyboardInset(
          window.innerHeight,
          vv.height,
          vv.offsetTop,
        ),
      );
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return inset;
}
