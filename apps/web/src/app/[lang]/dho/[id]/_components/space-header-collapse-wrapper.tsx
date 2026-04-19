'use client';

import { JoinSpace } from '@hypha-platform/epics';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

import { ActionButtons } from './action-buttons';

/** Matches MenuTop min-h-[65px] — compact bar stacks under global header */
const MENU_TOP_OFFSET_PX = 65;

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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showCompact, setShowCompact] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tCommon = useTranslations('Common');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowCompact(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: `-${MENU_TOP_OFFSET_PX}px 0px 0px 0px`,
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const avatarSrc = logoUrl || DEFAULT_SPACE_AVATAR_IMAGE;

  const compactBar =
    mounted &&
    showCompact &&
    createPortal(
      <div
        className={cn(
          'fixed left-0 right-0 z-[29] border-b border-border bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/85',
        )}
        style={{ top: MENU_TOP_OFFSET_PX }}
        role="region"
        aria-label={title}
      >
        <div className="mx-auto flex max-w-container-2xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0 rounded-full">
              <AvatarImage src={avatarSrc} alt="" className="object-cover" />
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-3 font-semibold leading-tight text-foreground">
                {title}
              </p>
              <p className="truncate text-1 text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {spaceMembers}
                </span>{' '}
                {tCommon('Members')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {typeof web3SpaceId === 'number' ? (
              <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
            ) : null}
            <ActionButtons web3SpaceId={web3SpaceId as number} />
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div className="relative">
        <div
          ref={sentinelRef}
          className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-px w-full"
          aria-hidden
        />
        {children}
      </div>
      {compactBar}
    </>
  );
}
