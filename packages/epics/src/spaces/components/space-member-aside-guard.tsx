'use client';

import { Space } from '@hypha-platform/core/client';
import { useCanMutateInSpace } from '../hooks/use-can-mutate-in-space.web3.rpc';
import { SpaceAccessDenied } from './space-access-denied';
import { Skeleton } from '@hypha-platform/ui';
import { ModalStickyNavigation } from '../../common/modal-sticky-navigation';

type SpaceMemberAsideGuardProps = {
  spaceSlug: string;
  spaceId?: number;
  space?: Space | null;
  /**
   * Where the close control goes while the guard shows its loading or denied
   * state (the form's own header is not there yet). Unset in the main app.
   */
  closeUrl?: string;
  children: React.ReactNode;
};

export function SpaceMemberAsideGuard({
  spaceSlug,
  spaceId,
  space,
  closeUrl,
  children,
}: SpaceMemberAsideGuardProps) {
  const { canMutate, isLoading, userState } = useCanMutateInSpace({
    spaceId,
    spaceSlug,
    space,
  });

  const closeBar = closeUrl ? (
    <ModalStickyNavigation closeUrl={closeUrl} />
  ) : null;

  if (isLoading) {
    return (
      <div
        className="flex min-h-[12rem] flex-col gap-3 p-4"
        aria-busy="true"
        aria-live="polite"
      >
        {closeBar}
        <Skeleton loading height={24} width="60%" />
        <Skeleton loading height={120} width="100%" />
      </div>
    );
  }

  if (!canMutate) {
    return (
      <>
        {closeBar}
        <SpaceAccessDenied
          userState={userState}
          spaceId={spaceId}
          spaceSlug={spaceSlug}
        />
      </>
    );
  }

  return <>{children}</>;
}
