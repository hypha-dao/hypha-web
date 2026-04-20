'use client';

import type { ReactNode } from 'react';
import { JoinSpace } from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';

import { ActionButtons } from './action-buttons';
import { useSpaceHeaderMorph } from './space-header-morph-context';

type SpaceHeaderCompactBarProps = {
  mounted: boolean;
  title: string;
  logoUrl: string | null;
  breadcrumbs: ReactNode;
  navLink: ReactNode | null;
  web3SpaceId: number | null;
  spaceId: number;
};

/**
 * Fixed strip: avatar + breadcrumbs + same Join/Action buttons as below hero, with
 * Space nav to the right. Shows only while `compactBarActive` so it overlays that row.
 */
export function SpaceHeaderCompactBar({
  mounted,
  title,
  logoUrl,
  breadcrumbs,
  navLink,
  web3SpaceId,
  spaceId,
}: SpaceHeaderCompactBarProps) {
  const { progress, reducedMotion, compactBarActive } = useSpaceHeaderMorph();
  const avatarSrc = logoUrl || DEFAULT_SPACE_AVATAR_IMAGE;

  const barOpacity = useMemo(() => {
    if (!compactBarActive) return 0;
    return Math.min(1, Math.max(0, (progress - 0.08) / 0.35));
  }, [compactBarActive, progress]);

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!mounted || !portalReady || !compactBarActive || barOpacity < 0.05) {
    return null;
  }

  const top = `calc(var(--app-menu-top-h, 65px) + var(--app-subnav-h, 0px))`;

  return createPortal(
    <div
      className={cn(
        'fixed left-0 right-0 z-[29] border-b border-border bg-background-2',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
      )}
      style={{
        top,
        opacity: barOpacity,
        transform: reducedMotion
          ? undefined
          : `translateY(${(1 - barOpacity) * 4}px)`,
        transition: reducedMotion
          ? undefined
          : 'opacity 0.15s ease-out, transform 0.15s ease-out',
        pointerEvents: barOpacity > 0.2 ? 'auto' : 'none',
      }}
      role="region"
      aria-label={title}
    >
      <div className="mx-auto flex max-w-container-2xl flex-col gap-2 px-5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <Avatar
            className={cn(
              'h-8 w-8 shrink-0 rounded-full shadow-md ring-1 ring-border/50 sm:h-9 sm:w-9',
            )}
          >
            <AvatarImage src={avatarSrc} alt="" className="object-cover" />
          </Avatar>
          <div className="min-w-0 flex-1 overflow-hidden text-muted-foreground [&_a]:text-foreground [&_a:hover]:text-accent-11">
            {breadcrumbs}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {typeof web3SpaceId === 'number' ? (
              <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
            ) : null}
            {typeof web3SpaceId === 'number' ? (
              <ActionButtons web3SpaceId={web3SpaceId} />
            ) : null}
          </div>
          {navLink ? (
            <div className="flex shrink-0 items-center border-border pl-2 sm:border-l sm:pl-3">
              {navLink}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
