'use client';

import { FC, useEffect, useState } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Empty } from '@hypha-platform/epics';

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
          <div className="flex flex-col items-center gap-2 py-7 text-center text-success-11">
            <CircleCheck className="size-7" />
            <div className="flex flex-col gap-1 text-1">
              <p className="font-semibold">{t('successTitle')}</p>
              <p className="text-muted-foreground">{t('successBody')}</p>
            </div>
          </div>
        ) : null}

        {state.kind === 'failure' ? (
          <Empty>
            <p className="font-semibold text-foreground">{t('failureTitle')}</p>
            <p className="text-muted-foreground">{t('failureBody')}</p>
          </Empty>
        ) : null}
      </div>
    </div>
  );
};
