'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useProfile } from '../hooks/use-profile';
import { ButtonProfile } from './button-profile';

export const ConnectedButtonProfile = () => {
  const { isAuthenticated, login, logout, user } = useAuthentication();
  const { profile } = useProfile({ address: user?.wallet?.address });

  return (
    <ButtonProfile
      avatarSrc={profile?.avatar}
      userName={profile?.name}
      address={user?.wallet?.address}
      isConnected={isAuthenticated}
      login={login}
      logout={logout}
    />
  );
};
