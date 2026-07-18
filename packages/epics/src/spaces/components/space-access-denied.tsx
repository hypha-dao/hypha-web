'use client';

import { Button } from '@hypha-platform/ui';
import { Empty } from '../../common/empty';
import { UserSpaceState } from '../hooks/use-user-space-state.web3.rpc';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpacesByWeb3Ids } from '@hypha-platform/core/client';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { JoinSpace } from './join-space';

type SpaceAccessDeniedProps = {
  userState: UserSpaceState;
  spaceId?: number;
  spaceSlug?: string;
  className?: string;
};

export function SpaceAccessDenied({
  userState,
  spaceId,
  spaceSlug,
  className,
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

  if (userState === UserSpaceState.NOT_LOGGED_IN) {
    return (
      <Empty className={className}>
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
      <Empty className={className}>
        <div className="flex flex-col gap-7">
          <p>{t('accessDeniedNotMember')}</p>
          {/* FR-4 / D-2: web3 identity is enough — do not require DB space.id */}
          {effectiveSpaceId ? (
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
    <Empty className={className}>
      <p>{t('accessDenied')}</p>
    </Empty>
  );
}
