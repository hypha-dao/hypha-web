// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React, { useEffect, useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { touchComposerFromViewportFlags } from '../touch-composer-flags';

/**
 * Same hydrate shape as `useIsMobile` / `usePrefersCoarsePointer`: first paint
 * is `undefined`, then an effect writes the real viewport flag.
 */
function useDeferredFlag(value: boolean | undefined) {
  const [flag, setFlag] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    setFlag(value);
  }, [value]);
  return flag;
}

function ShortCircuitedViewportHooks({ mobile }: { mobile: boolean }) {
  const touch =
    (useDeferredFlag(mobile) ?? false) || (useDeferredFlag(true) ?? false);
  const label = useMemo(() => String(touch), [touch]);
  return <div>{label}</div>;
}

function SeparateViewportHooks({ mobile }: { mobile: boolean }) {
  const isMobile = useDeferredFlag(mobile);
  const prefersCoarsePointer = useDeferredFlag(true);
  const touch = touchComposerFromViewportFlags(isMobile, prefersCoarsePointer);
  const label = useMemo(() => String(touch), [touch]);
  return <div>{label}</div>;
}

describe('mobile viewport hook order (390 hydrate)', () => {
  it('throws #310/#311 when || skips the second hook after mobile hydrate', () => {
    expect(() => {
      render(<ShortCircuitedViewportHooks mobile />);
    }).toThrow(
      /Rendered (more|fewer) hooks than expected|Should have a queue|Cannot read properties of undefined|change in the order of Hooks/,
    );
  });

  it('stays stable when each viewport hook is its own statement', () => {
    expect(() => {
      const { rerender } = render(<SeparateViewportHooks mobile />);
      rerender(<SeparateViewportHooks mobile />);
    }).not.toThrow();
  });
});
