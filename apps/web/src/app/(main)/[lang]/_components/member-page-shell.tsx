'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemberExperience } from '@hypha-platform/epics';
import { Container } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Shared member screen stack — same vertical rhythm on home, signals,
 * decisions, members, treasury, energy, wallet, and messages.
 */
export const MEMBER_SCREEN_STACK = 'flex w-full min-w-0 flex-col gap-4 py-4';

/**
 * Member content gutters (image 2 / Rue Verte): ~7–8% each side on wide
 * screens so the column sits around 80–85% of the pane. Phone keeps a
 * usable inset without eating the strip.
 */
export const MEMBER_CONTENT_GUTTER =
  'px-6 sm:px-10 md:px-12 lg:px-[max(4rem,7vw)] xl:px-[max(5rem,8vw)]';

/** Builder / funder space column — tight padding next to side panels. */
export const SPACE_CONTENT_GUTTER = 'px-4 sm:px-5';

/**
 * Members get the wide Rue Verte gutters. Builders and funders keep the
 * centered Container.
 */
export function MemberPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isMember } = useMemberExperience();

  if (isMember) {
    return (
      <div
        className={cn(MEMBER_SCREEN_STACK, MEMBER_CONTENT_GUTTER, className)}
      >
        {children}
      </div>
    );
  }

  return (
    <Container
      className={cn(
        'flex min-w-0 flex-col gap-4 py-4 xl:gap-4 xl:pt-4 xl:pb-9',
        className,
      )}
    >
      {children}
    </Container>
  );
}

/**
 * Space scrollport padding: members get the wide gutters; everyone else
 * keeps the compact space padding.
 */
export function SpaceContentGutter({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { isMember } = useMemberExperience();
  return (
    <div
      data-space-scroll-hold=""
      className={cn(
        'mt-[2px] min-w-0 flex-1 md:mt-[6px]',
        isMember ? MEMBER_CONTENT_GUTTER : SPACE_CONTENT_GUTTER,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
