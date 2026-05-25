'use client';

import '@hypha-platform/ui-utils/global.css';
import { getLocaleMessagesSync } from '@hypha-platform/i18n/messages';
import { isTransientAppNetworkError } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error] Unhandled root error', error);
  }, [error]);

  const localeFromPath =
    typeof window === 'undefined'
      ? 'en'
      : window.location.pathname.split('/').filter(Boolean)[0];
  const { messages } = getLocaleMessagesSync(localeFromPath);
  const common =
    (messages['Common'] as Record<string, unknown> | undefined) ?? {};
  const isConnectionLost = isTransientAppNetworkError(error);
  const title = isConnectionLost
    ? (common['errorConnectionLostTitle'] as string | undefined) ??
      'Connection lost'
    : (common['errorMaintenanceTitle'] as string | undefined) ??
      "We'll Be Back Shortly!";
  const description = isConnectionLost
    ? (common['errorConnectionLostDescription'] as string | undefined) ??
      'Your network connection was interrupted. Check your connection and try again.'
    : (common['errorMaintenanceDescription'] as string | undefined) ??
      "Hypha is taking a short break while we roll out updates. We'll be back soon with exciting improvements on the way!";
  const actionLabel = isConnectionLost
    ? (common['errorConnectionLostRetry'] as string | undefined) ?? 'Try again'
    : (common['errorRefreshPage'] as string | undefined) ?? 'Refresh Page';

  return (
    <html>
      <body>
        <div className="relative flex min-h-screen w-full items-center justify-center">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-2 text-center md:p-0">
            <h2 className="text-9 font-medium">{title}</h2>
            <p className="text-4 text-neutral-11">{description}</p>
            <Button
              type="button"
              colorVariant="accent"
              variant="default"
              className="gap-2"
              onClick={reset}
            >
              <ReloadIcon />
              {actionLabel}
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
