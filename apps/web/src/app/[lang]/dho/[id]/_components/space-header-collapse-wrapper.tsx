'use client';

import { useEffect, useRef, useState } from 'react';

import { SpaceHeaderCompactBar } from './space-header-compact-bar';
import { SpaceHeaderMorphProvider } from './space-header-morph-context';
import { SpaceStickyPadSync } from './space-sticky-pad-sync';

type SpaceHeaderCollapseWrapperProps = {
  children: React.ReactNode;
  menuBreadcrumbBridge: React.ReactNode;
  title: string;
  logoUrl: string | null;
  web3SpaceId: number | null;
  spaceId: number;
  heroCompactBreadcrumbs: React.ReactNode;
  heroCompactNav: React.ReactNode | null;
};

export function SpaceHeaderCollapseWrapper({
  children,
  menuBreadcrumbBridge,
  title,
  logoUrl,
  web3SpaceId,
  spaceId,
  heroCompactBreadcrumbs,
  heroCompactNav,
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
      <SpaceHeaderCompactBar
        mounted={mounted}
        title={title}
        logoUrl={logoUrl}
        breadcrumbs={heroCompactBreadcrumbs}
        navLink={heroCompactNav}
        web3SpaceId={web3SpaceId}
        spaceId={spaceId}
      />

      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
