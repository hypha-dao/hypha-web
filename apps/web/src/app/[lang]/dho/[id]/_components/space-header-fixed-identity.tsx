'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const STRIP_H_PX = 52;

type SpaceHeaderFixedIdentityProps = {
  title: string;
  logoUrl: string | null;
  spaceMembers: number;
  mounted: boolean;
};

export function SpaceHeaderFixedIdentity({
  title,
  logoUrl,
  spaceMembers,
  mounted,
}: SpaceHeaderFixedIdentityProps) {
  const { progress, reducedMotion } = useSpaceHeaderMorph();
  const tCommon = useTranslations('Common');
  const avatarSrc = logoUrl || DEFAULT_SPACE_AVATAR_IMAGE;

  const barOpacity = useMemo(
    () =>
      reducedMotion
        ? progress > 0.35
          ? 1
          : 0
        : smoothstep(0.2, 0.48, progress),
    [progress, reducedMotion],
  );

  useEffect(() => {
    const h = barOpacity > 0.08 ? `${STRIP_H_PX}px` : '0px';
    document.documentElement.style.setProperty('--dho-identity-strip-h', h);
    return () => {
      document.documentElement.style.removeProperty('--dho-identity-strip-h');
    };
  }, [barOpacity]);

  if (!mounted || progress <= 0.02 || barOpacity < 0.02) return null;

  return createPortal(
    <div
      className={cn(
        'fixed left-0 right-0 z-[29] overflow-hidden border-b border-border bg-background-2',
        'pointer-events-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
      )}
      style={{
        top: 'var(--app-menu-top-h, 65px)',
        height: STRIP_H_PX,
        opacity: barOpacity,
      }}
      aria-hidden
    >
      <div
        className={cn(
          'mx-auto flex h-full max-w-container-2xl items-center gap-2.5 px-5 sm:gap-3',
        )}
      >
        <Avatar
          className={cn(
            'h-8 w-8 shrink-0 rounded-full shadow-md ring-1 ring-border/40',
          )}
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
            {tCommon('Members')}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
