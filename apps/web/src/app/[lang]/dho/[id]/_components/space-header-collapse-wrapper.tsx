'use client';

import { JoinSpace } from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ActionButtons } from './action-buttons';
import {
  SpaceHeaderMorphProvider,
  useSpaceHeaderMorph,
} from './space-header-morph-context';
import { SpaceStickyPadSync } from './space-sticky-pad-sync';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function MorphCompactBarPortal({
  title,
  logoUrl,
  spaceMembers,
  web3SpaceId,
  spaceId,
  tMembers,
  mounted,
}: {
  title: string;
  logoUrl: string | null;
  spaceMembers: number;
  web3SpaceId: number | null;
  spaceId: number;
  tMembers: string;
  mounted: boolean;
}) {
  const { progress, reducedMotion } = useSpaceHeaderMorph();
  const avatarSrc = logoUrl || DEFAULT_SPACE_AVATAR_IMAGE;

  const barOpacity = useMemo(
    () => smoothstep(0.12, 0.48, progress),
    [progress],
  );
  const barLift = useMemo(() => (1 - progress) * 6, [progress]);

  if (!mounted || progress <= 0.02) return null;

  return createPortal(
    <div
      className={cn(
        'fixed left-0 right-0 z-[29] overflow-hidden border-t border-border bg-background-2',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
      )}
      style={{
        top: `calc(var(--app-menu-top-h, 65px) + var(--app-subnav-h, 0px))`,
        opacity: barOpacity,
        transform: reducedMotion ? undefined : `translateY(${barLift}px)`,
        transition: reducedMotion
          ? undefined
          : 'opacity 0.18s ease-out, transform 0.2s ease-out',
        pointerEvents: progress > 0.16 ? 'auto' : 'none',
      }}
      role="region"
      aria-label={title}
    >
      <div className="mx-auto flex max-w-container-2xl items-center justify-between gap-2 px-5 py-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <Avatar
            className={cn(
              'h-8 w-8 shrink-0 rounded-full shadow-md ring-1 ring-border/50 sm:h-9 sm:w-9',
            )}
            style={{
              transform: reducedMotion
                ? undefined
                : `scale(${0.86 + progress * 0.14})`,
            }}
          >
            <AvatarImage src={avatarSrc} alt="" className="object-cover" />
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2 font-semibold leading-tight text-foreground sm:text-3">
              {title}
            </p>
            <p className="truncate text-1 text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {spaceMembers}
              </span>{' '}
              {tMembers}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {typeof web3SpaceId === 'number' ? (
            <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
          ) : null}
          <ActionButtons web3SpaceId={web3SpaceId as number} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type SpaceHeaderCollapseWrapperProps = {
  children: React.ReactNode;
  title: string;
  logoUrl: string | null;
  spaceMembers: number;
  web3SpaceId: number | null;
  spaceId: number;
};

export function SpaceHeaderCollapseWrapper({
  children,
  title,
  logoUrl,
  spaceMembers,
  web3SpaceId,
  spaceId,
}: SpaceHeaderCollapseWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const tCommon = useTranslations('Common');

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SpaceHeaderMorphProvider containerRef={containerRef}>
      <SpaceStickyPadSync />
      <MorphCompactBarPortal
        mounted={mounted}
        title={title}
        logoUrl={logoUrl}
        spaceMembers={spaceMembers}
        web3SpaceId={web3SpaceId}
        spaceId={spaceId}
        tMembers={tCommon('Members')}
      />

      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SpaceHeaderMorphProvider>
  );
}
