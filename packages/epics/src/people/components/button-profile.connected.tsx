'use client';

import { ButtonProfile } from './button-profile';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';
import { useEffect, useMemo } from 'react';
import { ButtonNavItemProps } from '@hypha-platform/ui';
import { useTheme } from 'next-themes';

type ConnectedButtonProfileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
  newUserRedirectPath: string;
  baseRedirectPath: string;
  navItems: ButtonNavItemProps[];
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
  const { resolvedTheme, setTheme } = useTheme();

  const notificationCentrePath = useMemo(() => {
    if (!isPersonLoading && person?.slug) {
      return `/profile/${person.slug}/notification-centre`;
    } else {
      return undefined;
    }
  }, [person, isPersonLoading]);

  useEffect(() => {
    if (isAuthLoading || isPersonLoading || !isAuthenticated) {
      return;
    }
    if (user) {
      if (person) {
        if (isErrorUser(person)) {
          if (person.error !== 'Internal Server Error') {
            router.push(newUserRedirectPath);
          }
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
    person,
    user,
    router,
    baseRedirectPath,
    newUserRedirectPath,
    isLoggingIn,
    setLoggingIn,
  ]);

  const handleThemeChange = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleOnDelete = () => {
    console.log('Delete profile');
  };

  return (
    <ButtonProfile
      address={user?.wallet?.address}
      person={person}
      isConnected={isAuthenticated}
      onLogin={login}
      onLogout={logout}
      onDelete={handleOnDelete}
      onChangeThemeMode={handleThemeChange}
      resolvedTheme={resolvedTheme}
      profileUrl={
        person?.slug
          ? `/${lang}/profile/${person?.slug ?? ''}`
          : newUserRedirectPath
      }
      notificationCentrePath={notificationCentrePath}
      navItems={navItems}
    />
  );
};
