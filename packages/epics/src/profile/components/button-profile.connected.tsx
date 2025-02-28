'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { ButtonProfile } from './button-profile';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useMe } from '../hooks/use-me';

export const ConnectedButtonProfile = () => {
  const { isAuthenticated, login, logout, user } = useAuthentication();
  const { person } = useMe();

  const router = useRouter();
  const { lang } = useParams();

  return (
    <ButtonProfile
      avatarSrc={person?.avatarUrl ?? ''}
      userName={person?.name ?? ''}
      address={user?.wallet?.address}
      isConnected={isAuthenticated}
      onLogin={login}
      onLogout={logout}
      onProfile={() => {
        router.push(`/${lang}/profile/`);
      }}
    />
  );
};
