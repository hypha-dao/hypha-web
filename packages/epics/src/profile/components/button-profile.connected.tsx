'use client';

import { ButtonProfile } from './button-profile';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { UseAuthentication } from 'packages/authentication/src/shared/types';
import { UseMe } from '../hooks/types';
import { useEffect } from 'react';

type ConnectedButtonProfileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
  newUserRedirectPath: string;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
}: ConnectedButtonProfileProps) => {
  const { isAuthenticated, login, logout, user } = useAuthentication();
  const { person, isLoading } = useMe({ newUserRedirectPath });

  const router = useRouter();
  const { lang } = useParams();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !person?.id) {
      router.push(newUserRedirectPath);
    }
  }, [isAuthenticated, isLoading, person]);

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
