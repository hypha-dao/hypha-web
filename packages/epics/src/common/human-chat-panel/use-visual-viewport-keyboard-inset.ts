'use client';

import { useEffect, useState } from 'react';

import {
  effectiveComposerKeyboardInset,
  stabilizeComposerKeyboardInset,
  visualViewportKeyboardInset,
} from './visual-viewport-keyboard';

/** Pixels of the layout viewport covered by the keyboard. Zero unless focused. */
export function useVisualViewportKeyboardInset(
  composerFocused = false,
): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!composerFocused) {
      setInset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        try {
          const next = effectiveComposerKeyboardInset(
            visualViewportKeyboardInset(
              window.innerHeight,
              vv.height,
              vv.offsetTop,
            ),
            true,
          );
          setInset((current) => stabilizeComposerKeyboardInset(current, next));
        } catch {
          setInset(0);
        }
      });
    };

    try {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      window.addEventListener('resize', update);
      update();
    } catch {
      setInset(0);
      return;
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      try {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      } catch {
        // visualViewport can disappear with the mobile sheet
      }
    };
  }, [composerFocused]);

  return composerFocused ? inset : 0;
}
