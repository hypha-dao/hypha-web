'use client';

import { useEffect, useRef, useState } from 'react';

import { SpaceHeaderFixedActions } from './space-header-fixed-actions';
import { SpaceHeaderFixedIdentity } from './space-header-fixed-identity';
import { SpaceHeaderMorphProvider } from './space-header-morph-context';
import { SpaceStickyPadSync } from './space-sticky-pad-sync';

type SpaceHeaderCollapseWrapperProps = {
  children: React.ReactNode;
  menuBreadcrumbBridge: React.ReactNode;
  nestedSlot?: React.ReactNode;
  title: string;
  logoUrl: string | null;
  spaceMembers: number;
  web3SpaceId: number | null;
  spaceId: number;
};

export function SpaceHeaderCollapseWrapper({
  children,
  menuBreadcrumbBridge,
  nestedSlot,
  title,
  logoUrl,
  spaceMembers,
  web3SpaceId,
  spaceId,
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
      <SpaceHeaderFixedIdentity
        mounted={mounted}
        title={title}
        logoUrl={logoUrl}
        spaceMembers={spaceMembers}
      />
      <SpaceHeaderFixedActions
        mounted={mounted}
        web3SpaceId={web3SpaceId}
        spaceId={spaceId}
      />

      {nestedSlot ? (
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
          {nestedSlot}
        </div>
      ) : null}

      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
