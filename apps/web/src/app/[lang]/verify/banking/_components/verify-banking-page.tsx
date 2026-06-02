'use client';

import { FC, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type VerifyBankingPageProps = {
  token: string | null;
};

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'missing_token' }
  | { kind: 'success' }
  | { kind: 'failure' };

export const VerifyBankingPage: FC<VerifyBankingPageProps> = ({ token }) => {
  const t = useTranslations('BankingTab.emailConfirmation.verifyPage');
  const [state, setState] = useState<VerifyState>(() =>
    token ? { kind: 'loading' } : { kind: 'missing_token' },
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/v1/banking/token-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };

        if (cancelled) {
          return;
        }

        setState(body.ok === true ? { kind: 'success' } : { kind: 'failure' });
      } catch {
        if (!cancelled) {
          setState({ kind: 'failure' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        {state.kind === 'loading' ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-2 text-muted-foreground">{t('loading')}</p>
          </>
        ) : null}

        {state.kind === 'missing_token' ? (
          <p className="text-2 text-foreground">{t('missingToken')}</p>
        ) : null}

        {state.kind === 'success' ? (
          <>
            <h1 className="text-4 font-semibold text-foreground">
              {t('successTitle')}
            </h1>
            <p className="text-2 text-muted-foreground">{t('successBody')}</p>
          </>
        ) : null}

        {state.kind === 'failure' ? (
          <>
            <h1 className="text-4 font-semibold text-foreground">
              {t('failureTitle')}
            </h1>
            <p className="text-2 text-muted-foreground">{t('failureBody')}</p>
          </>
        ) : null}
      </div>
    </div>
  );
};
