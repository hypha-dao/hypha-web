'use client';

import * as React from 'react';
import { AUTH_SERVER_LANG_COOKIE } from '@hypha-platform/auth-server/client';

/**
 * Keeps the page's `lang` attribute right (the layout only knows the cookie and the browser's
 * language, not `?lang=`) and remembers a language chosen with `?lang=`, so the consent page
 * after the login page keeps it. Host-only cookie, no personal data.
 */
export function LocaleSync({
  locale,
  persist,
}: {
  locale: string;
  persist: boolean;
}) {
  React.useEffect(() => {
    document.documentElement.lang = locale;
    if (!persist) return;
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${AUTH_SERVER_LANG_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // Cookies blocked: the language still applies to this page.
    }
  }, [locale, persist]);
  return null;
}
