'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

import { SpaceHeaderMorphProvider } from './space-header-morph-context';

type SpaceHeaderShellProps = {
  /** Optional portal slot (e.g. menu breadcrumb bridge) */
  menuBridge?: ReactNode;
  children: ReactNode;
};

/**
 * Client boundary for scroll-driven header state (`SpaceHeaderMorphProvider`).
 * Wraps all space header content that reads `useSpaceHeaderMorph()`.
 */
export function SpaceHeaderShell({
  menuBridge,
  children,
}: SpaceHeaderShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <SpaceHeaderMorphProvider containerRef={containerRef}>
      {menuBridge}
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
