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
  notAuthenticatedRedirectPath: string;
};

type ErrorUser = {
  error: string;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
  baseRedirectPath,
  notAuthenticatedRedirectPath,
}: ConnectedButtonProfileProps) => {
  const {
    isAuthenticated,
    logout,
    login,
    user,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const { person, isLoading: isPersonLoading } = useMe();

  const router = useRouter();
  const { lang } = useParams();

  useEffect(() => {
    if (isAuthLoading || isPersonLoading || !isAuthenticated) {
      return;
    }
    if (user) {
      if (person) {
        if ((person as unknown as ErrorUser)?.error) {
          router.push(newUserRedirectPath);
        } else if (person?.id) {
          router.push(baseRedirectPath);
        }
      } else {
        router.push(notAuthenticatedRedirectPath);
      }
    }
  }, [
    isPersonLoading,
    isAuthLoading,
    isAuthenticated,
    person,
    user,
    router,
    baseRedirectPath,
    newUserRedirectPath,
    notAuthenticatedRedirectPath,
  ]);

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
