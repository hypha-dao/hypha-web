'use client';

import '@hypha-platform/ui-utils/global.css';
import { loadLocaleMessages } from '@hypha-platform/i18n/messages';
import { Button } from '@hypha-platform/ui';
import { ReloadIcon } from '@radix-ui/react-icons';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Messages = Record<string, unknown>;
type IntlState = { locale: string; messages: Messages };

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const tCommon = useTranslations('Common');

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-2 text-center md:p-0">
        <h2 className="text-9 font-medium">{tCommon('errorMaintenanceTitle')}</h2>
        <p className="text-4 text-neutral-11">
          {tCommon('errorMaintenanceDescription')}
        </p>
        <Button
          type="button"
          colorVariant="accent"
          variant="default"
          className="gap-2"
          onClick={reset}
        >
          <ReloadIcon />
          {tCommon('errorRefreshPage')}
        </Button>
      </div>
    </div>
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [intlState, setIntlState] = useState<IntlState | null>(null);

  useEffect(() => {
    console.error('[app/global-error] Unhandled root error', error);
  }, [error]);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      const locale = window.location.pathname.split('/').filter(Boolean)[0];
      const data = await loadLocaleMessages(locale);
      if (!cancelled) {
        setIntlState(data);
      }
    };

    loadMessages().catch((loadError) => {
      console.error('[app/global-error] Failed to load i18n messages', loadError);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const locale = intlState?.locale ?? 'en';
  const messages = intlState?.messages ?? {};

  return (
    <html>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <GlobalErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
