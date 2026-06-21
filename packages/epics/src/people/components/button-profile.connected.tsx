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
  compact?: boolean;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
  newUserRedirectPath,
  baseRedirectPath,
  resolvePostAuthRedirectPathOrDefault,
  navItems,
  trailingBeforeProfile,
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
  const {
    person,
    isLoading: isPersonLoading,
    needsProfileSetup = false,
  } = useMe();

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

  const profileUrl = useMemo(() => {
    if (isPersonLoading) {
      return undefined;
    }
    if (person?.slug) {
      return `/${lang}/profile/${person.slug}`;
    }
    if (needsProfileSetup) {
      return localizedSignupPath;
    }
    return undefined;
  }, [
    isPersonLoading,
    person?.slug,
    needsProfileSetup,
    lang,
    localizedSignupPath,
  ]);

  useEffect(() => {
    if (isAuthLoading || isPersonLoading || !isAuthenticated) {
      return;
    }
    if (!user) {
      return;
    }

    if (
      needsProfileSetup &&
      pathname !== newUserRedirectPath &&
      pathname !== localizedSignupPath
    ) {
      router.push(localizedSignupPath);
      return;
    }

    if (
      person &&
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
    needsProfileSetup,
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
      isPersonLoading={isPersonLoading}
      isConnected={isAuthenticated}
      onLogin={login}
      onLogout={logout}
      onDelete={handleOnDelete}
      onChangeThemeMode={handleThemeChange}
      resolvedTheme={resolvedTheme}
      profileUrl={profileUrl}
      onboardingUrl={onboardingUrl}
      notificationCentrePath={notificationCentrePath}
      navItems={navItems}
      trailingBeforeProfile={trailingBeforeProfile}
      compact={compact}
    />
  );
};
