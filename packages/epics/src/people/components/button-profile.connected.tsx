'use client';

import { ButtonProfile } from './button-profile';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';
import { useEffect } from 'react';
import { ButtonNavItemProps } from "@hypha-platform/ui";

type ConnectedButtonProfileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
  newUserRedirectPath: string;
  baseRedirectPath: string;
  navItems: ButtonNavItemProps[]
};

type ErrorUser = {
  error: string;
};

const isErrorUser = (obj: any): obj is ErrorUser => {
  return obj && typeof obj === 'object' && 'error' in obj;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
  baseRedirectPath,
  navItems,
}: ConnectedButtonProfileProps) => {
  const {
    isAuthenticated,
    logout,
    login,
    isLoggingIn,
    setLoggingIn,
    user,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const { person, isLoading: isPersonLoading } = useMe();

  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useParams();

  useEffect(() => {
    if (isAuthLoading || isPersonLoading || !isAuthenticated) {
      return;
    }
    if (user) {
      if (person) {
        if (isErrorUser(person)) {
          router.push(newUserRedirectPath);
        } else if (
          (person?.id && pathname === newUserRedirectPath) ||
          isLoggingIn
        ) {
          router.push(baseRedirectPath);
          setLoggingIn(false);
        }
      } else {
        logout();
      }
    }
  }, [
    isPersonLoading,
    isAuthLoading,
    isAuthenticated,
    // person, // TODO: will be fixed within the framework #868
    user,
    router,
    pathname,
    baseRedirectPath,
    newUserRedirectPath,
    isLoggingIn,
    setLoggingIn,
  ]);

  return (
    <ButtonProfile
      avatarSrc={person?.avatarUrl ?? ''}
      userName={person?.name ?? ''}
      address={user?.wallet?.address}
      isConnected={isAuthenticated}
      onLogin={login}
      onLogout={logout}
      profileUrl={`/${lang}/profile`}
      navItems={navItems}
    />
  );
};
