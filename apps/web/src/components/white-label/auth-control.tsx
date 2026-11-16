'use client';

import * as React from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';

/**
 * Sign in / sign out of a mapped host, top right of the Space header (there is
 * no navbar on a host, and the header is always visible, also on a phone).
 * Icon only, no background, so it interrupts the banner as little as possible;
 * the label is the accessible name and the tooltip. White with a soft shadow
 * so it reads on any banner image. Goes through the same `useAuthentication`
 * seam as the shared sections. Rendered only on a host with login settings.
 * Sign out stays on the host: the main app's default (redirect to its network
 * page) would leave the Space.
 */
export function WhiteLabelAuthControl() {
  const t = useTranslations('Navigation');
  const { isAuthenticated, isLoading, login, logout } = useAuthentication();

  if (isLoading) return null;

  const label = isAuthenticated ? t('logout') : t('signIn');
  const Icon = isAuthenticated ? LogOut : LogIn;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (isAuthenticated) void logout(false);
        else void login();
      }}
      className="absolute right-1 top-1 z-20 flex size-10 items-center justify-center rounded-full text-white/85 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.6))] transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:right-2 md:top-2"
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
