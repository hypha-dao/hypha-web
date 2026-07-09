'use client';

import { ButtonProfile } from './button-profile';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
  ProfileUseAuthentication,
  ResolvePostAuthRedirectPathOrDefault,
  UseMe,
} from '../hooks/types';
import { useEffect, useMemo, type ReactNode } from 'react';
import { ButtonNavItemProps } from '@hypha-platform/ui';
import { useTheme } from 'next-themes';

type ConnectedButtonProfileProps = {
  useAuthentication: ProfileUseAuthentication;
  useMe: UseMe;
  newUserRedirectPath: string;
  baseRedirectPath: string;
  resolvePostAuthRedirectPathOrDefault: ResolvePostAuthRedirectPathOrDefault;
  navItems: ButtonNavItemProps[];
  trailingBeforeProfile?: ReactNode;
  beforeFirstNavItem?: ReactNode;
  compact?: boolean;
};

type ErrorUser = {
  error: string;
};

const isErrorUser = (obj: unknown): obj is ErrorUser => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as { error?: unknown }).error === 'string'
  );
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
  baseRedirectPath,
  resolvePostAuthRedirectPathOrDefault,
  navItems,
  trailingBeforeProfile,
  beforeFirstNavItem,
  compact = false,
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
  const { lang, id } = useParams();
  const { resolvedTheme, setTheme } = useTheme();
  const onboardingUrl =
    typeof lang === 'string' ? `/${lang}/onboarding` : undefined;
  const localizedSignupPath =
    typeof lang === 'string' ? `/${lang}/profile/signup` : newUserRedirectPath;

  const notificationCentrePath = useMemo(() => {
    if (!isPersonLoading && person?.slug) {
      if (pathname.includes('/network')) {
        return `/${lang}/network/notification-centre`;
      } else if (pathname.includes('/my-spaces')) {
        return `/${lang}/my-spaces/notification-centre`;
      } else if (pathname.includes('/dho/')) {
        return `/${lang}/dho/${id}/agreements/notification-centre`;
      } else {
        return `/${lang}/profile/${person.slug}/notification-centre`;
      }
    } else {
      return undefined;
    }
  }, [lang, id, person, isPersonLoading, pathname]);

  useEffect(() => {
    if (isAuthLoading || isPersonLoading || !isAuthenticated) {
      return;
    }
    if (user) {
      if (person) {
        if (isErrorUser(person)) {
          if (person.error !== 'Internal Server Error') {
            router.push(localizedSignupPath);
          }
        } else if (
          isLoggingIn &&
          pathname !== newUserRedirectPath &&
          pathname !== localizedSignupPath
        ) {
          if (!pathname.includes('/onboarding')) {
            router.push(
              resolvePostAuthRedirectPathOrDefault({
                pathname,
                lang: typeof lang === 'string' ? lang : undefined,
                baseRedirectPath,
              }),
            );
          }
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
    pathname,
    localizedSignupPath,
    lang,
    resolvePostAuthRedirectPathOrDefault,
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
      onboardingUrl={onboardingUrl}
      notificationCentrePath={notificationCentrePath}
      navItems={navItems}
      beforeFirstNavItem={beforeFirstNavItem}
      trailingBeforeProfile={trailingBeforeProfile}
      compact={compact}
    />
  );
};
