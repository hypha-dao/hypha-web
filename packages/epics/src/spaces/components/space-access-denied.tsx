'use client';

import { Button } from '@hypha-platform/ui';
import { Empty } from '../../common/empty';
import { UserSpaceState } from '../hooks/use-user-space-state';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { JoinSpace } from './join-space';

type SpaceAccessDeniedProps = {
  userState: UserSpaceState;
  spaceId?: number;
  spaceSlug?: string;
};

export function SpaceAccessDenied({
  userState,
  spaceId,
  spaceSlug,
}: SpaceAccessDeniedProps) {
  const { isAuthenticated } = useAuthentication();
  const { lang } = useParams();
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = spaceId || space?.web3SpaceId;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: effectiveSpaceId as number,
  });

  const isInviteOnly = spaceDetails?.joinMethod === 2n;

  if (userState === UserSpaceState.NOT_LOGGED_IN) {
    return (
      <Empty>
        <div className="flex flex-col gap-7">
          <p>
            You need an active account to access this section. Please sign in or
            click Get Started to create one.
          </p>
          <div className="flex gap-4 items-center justify-center">
            <Link href={`/${lang}/sign-in`}>
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href={`/${lang}/get-started`}>
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </Empty>
    );
  }

  if (
    userState === UserSpaceState.LOGGED_IN ||
    userState === UserSpaceState.LOGGED_IN_ORG
  ) {
    return (
      <Empty>
        <div className="flex flex-col gap-7">
          <p>
            You need to become a member to access this feature. Join the space
            now to view the activity of this space.
          </p>
          {effectiveSpaceId && space?.id ? (
            <div className="flex gap-4 items-center justify-center">
              <JoinSpace spaceId={space.id} web3SpaceId={effectiveSpaceId} />
            </div>
          ) : (
            <div className="flex gap-4 items-center justify-center">
              <Button disabled>
                {isInviteOnly
                  ? 'Request invite'
                  : 'Become a member or request invite'}
              </Button>
            </div>
          )}
        </div>
      </Empty>
    );
  }

  return (
    <Empty>
      <p>Access denied</p>
    </Empty>
  );
}
