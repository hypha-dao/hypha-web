'use client';

import type { CSSProperties, ReactNode } from 'react';
import { MEMBER_TITLE_GAP, useMemberExperience } from '@hypha-platform/epics';
import { Container } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Shared member screen stack — title → first content uses the same gap as
 * eyebrow → title (MEMBER_TITLE_GAP). Content blocks keep their own gaps.
 */
export const MEMBER_SCREEN_STACK = `flex w-full min-w-0 flex-col ${MEMBER_TITLE_GAP} py-4`;

/**
 * Space content gutters (image 2 / Rue Verte): ~7–8% each side on wide
 * screens so the column sits around 80–85% of the pane. Phone keeps a
 * usable inset without eating the strip. Same for members and builders.
 */
export const MEMBER_CONTENT_GUTTER =
  'px-6 sm:px-10 md:px-12 lg:px-[max(4rem,7vw)] xl:px-[max(5rem,8vw)]';

/**
 * Cancel {@link MEMBER_CONTENT_GUTTER} so a layer can bleed to the column
 * edges (builder overview mycelium / banner ground).
 */
export const MEMBER_CONTENT_GUTTER_BREAKOUT =
  '-mx-6 w-[calc(100%+3rem)] sm:-mx-10 sm:w-[calc(100%+5rem)] md:-mx-12 md:w-[calc(100%+6rem)] lg:-mx-[max(4rem,7vw)] lg:w-[calc(100%+2*max(4rem,7vw))] xl:-mx-[max(5rem,8vw)] xl:w-[calc(100%+2*max(5rem,8vw))]';

/** @deprecated Use MEMBER_CONTENT_GUTTER — kept for older call sites. */
export const SPACE_CONTENT_GUTTER = MEMBER_CONTENT_GUTTER;

/**
 * Members get the wide Rue Verte stack. Builders and funders keep the
 * centered Container on non-space surfaces (wallet, profile).
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
 * Space scrollport padding — same left/right gutters for every persona.
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
  return (
    <div
      data-space-scroll-hold=""
      className={cn(
        'mt-[2px] min-w-0 flex-1 md:mt-[6px]',
        MEMBER_CONTENT_GUTTER,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
