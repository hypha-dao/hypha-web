'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

import { SpaceHeaderMorphProvider } from './space-header-morph-context';
import { SpaceStickyPadSync } from './space-sticky-pad-sync';

type SpaceHeaderCollapseWrapperProps = {
  children: ReactNode;
  menuBreadcrumbBridge: ReactNode;
};

export function SpaceHeaderCollapseWrapper({
  children,
  menuBreadcrumbBridge,
}: SpaceHeaderCollapseWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <SpaceHeaderMorphProvider containerRef={containerRef}>
      {menuBreadcrumbBridge}
      <SpaceStickyPadSync />

      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
