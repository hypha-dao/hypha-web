'use client';

import type { ReactNode } from 'react';
import { useMemberExperience } from '@hypha-platform/epics';
import { Container } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Members get the same full-width column padding as space screens
 * (`px-4 sm:px-5`). Builders and funders keep the centered Container.
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
        className={cn(
          'flex w-full min-w-0 flex-col gap-4 px-4 py-4 sm:px-5',
          className,
        )}
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
