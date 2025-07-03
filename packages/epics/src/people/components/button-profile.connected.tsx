'use client';

import { ButtonProfile } from './button-profile';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';
import { useEffect } from 'react';

type ConnectedButtonProfileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
  newUserRedirectPath: string;
  baseRedirectPath: string;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
  baseRedirectPath,
}: ConnectedButtonProfileProps) => {
  const { isAuthenticated, logout, login, user } = useAuthentication();
  const { person, isLoading } = useMe();

  const router = useRouter();
  const { lang } = useParams();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    router.push(person?.id ? baseRedirectPath : newUserRedirectPath);
  }, [isLoading, isAuthenticated, user]);

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
