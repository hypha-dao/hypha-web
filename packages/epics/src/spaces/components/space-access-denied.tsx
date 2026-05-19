'use client';

import { Button } from '@hypha-platform/ui';
import { Empty } from '../../common/empty';
import { UserSpaceState } from '../hooks/use-user-space-state';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useSpaceDetailsWeb3Rpc,
  useSpacesByWeb3Ids,
} from '@hypha-platform/core/client';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Spaces');
  const { login } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = spaceId || space?.web3SpaceId;
  const { spaces: spacesByWeb3Id } = useSpacesByWeb3Ids(
    effectiveSpaceId ? [BigInt(effectiveSpaceId)] : [],
    false,
  );
  const resolvedSpaceId = space?.id ?? spacesByWeb3Id[0]?.id;

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
          {resolvedSpaceId && effectiveSpaceId ? (
            <div className="flex items-center justify-center">
              <JoinSpace
                spaceId={resolvedSpaceId}
                web3SpaceId={effectiveSpaceId}
                hideWhenMember
              />
            </div>
          ) : null}
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
