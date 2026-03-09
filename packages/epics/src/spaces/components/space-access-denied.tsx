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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('Spaces');
  const { isAuthenticated, login } = useAuthentication();
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
          <p>{t('accessDeniedNotLoggedIn')}</p>
          <div className="flex gap-4 items-center justify-center">
            <Button variant="outline" onClick={login}>
              {t('signIn')}
            </Button>
            <Button onClick={login}>{t('getStarted')}</Button>
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
          <p>{t('accessDeniedNotMember')}</p>
          {effectiveSpaceId && space?.id ? (
            <div className="flex gap-4 items-center justify-center">
              <JoinSpace spaceId={space.id} web3SpaceId={effectiveSpaceId} />
            </div>
          ) : (
            <div className="flex gap-4 items-center justify-center">
              <Button disabled>
                {isInviteOnly
                  ? t('requestInvite')
                  : t('becomeMemberOrRequestInvite')}
              </Button>
            </div>
          )}
        </div>
      </Empty>
    );
  }

  return (
    <Empty>
      <p>{t('accessDenied')}</p>
    </Empty>
  );
}
