'use client';

import { FC, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Container } from '@hypha-platform/ui';

type ConfirmState =
  | { status: 'loading' }
  | { status: 'success'; ownerLabel: string }
  | {
      status: 'error';
      reason: 'expired' | 'invalid' | 'already_confirmed' | 'generic';
    };

type VerifyBankingPageProps = {
  token: string | null;
};

/**
 * Public page (#2288) — no Privy auth: the token in the URL is the authorization (D4). Confirms
 * the submitter's email ownership before Hypha ever calls Bridge with it, then reports success or
 * a clear reason for failure inline (never a redirect, per decisions.md "Resolved").
 */
export const VerifyBankingPage: FC<VerifyBankingPageProps> = ({ token }) => {
  const t = useTranslations('VerifyBanking');
  const [state, setState] = useState<ConfirmState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', reason: 'invalid' });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/v1/banking/token-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          reason?: 'expired' | 'invalid' | 'already_confirmed';
          ownerLabel?: string;
        };

        if (cancelled) return;

        if (res.ok && body.ok) {
          setState({ status: 'success', ownerLabel: body.ownerLabel ?? '' });
          return;
        }

        setState({
          status: 'error',
          reason: body.reason ?? 'generic',
        });
      } catch {
        if (!cancelled) {
          setState({ status: 'error', reason: 'generic' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const errorCopy: Record<
    'expired' | 'invalid' | 'already_confirmed' | 'generic',
    { title: string; description: string }
  > = {
    expired: {
      title: t('errorExpiredTitle'),
      description: t('errorExpiredDescription'),
    },
    invalid: {
      title: t('errorInvalidTitle'),
      description: t('errorInvalidDescription'),
    },
    already_confirmed: {
      title: t('errorAlreadyConfirmedTitle'),
      description: t('errorAlreadyConfirmedDescription'),
    },
    generic: {
      title: t('errorGenericTitle'),
      description: t('errorGenericDescription'),
    },
  };

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      {state.status === 'loading' ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-3 font-semibold text-foreground">
            {t('loadingTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {t('loadingDescription')}
          </p>
        </>
      ) : state.status === 'success' ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-success-9" />
          <p className="text-3 font-semibold text-foreground">
            {t('successTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {t('successDescription', { ownerLabel: state.ownerLabel })}
          </p>
        </>
      ) : (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-3 font-semibold text-foreground">
            {errorCopy[state.reason].title}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {errorCopy[state.reason].description}
          </p>
        </>
      )}
    </Container>
  );
};
