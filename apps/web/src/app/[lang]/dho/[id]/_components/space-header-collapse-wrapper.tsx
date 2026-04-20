'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { SpaceHeaderFixedActions } from './space-header-fixed-actions';
import { SpaceHeaderMorphProvider } from './space-header-morph-context';
import { SpaceStickyPadSync } from './space-sticky-pad-sync';

type SpaceHeaderCollapseWrapperProps = {
  children: ReactNode;
  menuBreadcrumbBridge: ReactNode;
  web3SpaceId: number | null;
  spaceId: number;
  /** Shown in fixed mirror strip (duplicate of sticky identity) */
  identitySlot: ReactNode;
  navLink: ReactNode | null;
};

export function SpaceHeaderCollapseWrapper({
  children,
  menuBreadcrumbBridge,
  web3SpaceId,
  spaceId,
  identitySlot,
  navLink,
}: SpaceHeaderCollapseWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SpaceHeaderMorphProvider containerRef={containerRef}>
      {menuBreadcrumbBridge}
      <SpaceStickyPadSync />
      <SpaceHeaderFixedActions
        mounted={mounted}
        identitySlot={identitySlot}
        navLink={navLink}
        web3SpaceId={web3SpaceId}
        spaceId={spaceId}
      />

      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
