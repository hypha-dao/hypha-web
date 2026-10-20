'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import { useVote } from '@hypha-platform/core/client';
import { Button, Container } from '@hypha-platform/ui';

type ActionView = {
  status:
    | 'pending'
    | 'approved'
    | 'submitted'
    | 'rejected'
    | 'expired'
    | 'failed';
  summary: { headline: string; lines: { label: string; value: string }[] };
};

type SignRequest = { web3ProposalId: number; support: boolean };

type PageState =
  | { step: 'loading' }
  | { step: 'signed-out' }
  | { step: 'not-found' }
  | { step: 'error' }
  | { step: 'review'; action: ActionView }
  | { step: 'signing'; sign: SignRequest }
  | {
      step: 'final';
      outcome: 'submitted' | 'rejected' | 'expired' | 'used' | 'failed';
    };

const API = '/api/integration/v1/users/me/actions';

/** The wallet may still be attaching right after sign-in; retry briefly. */
const WALLET_NOT_READY = /wallet not connected/i;

type SignVoteProps = {
  sign: SignRequest;
  authToken: string | null;
  onDone: (hash: string | null) => void;
};

/**
 * Signs the vote through the same hook the proposal page uses (`useVote`: the
 * Privy smart wallet, sponsored gas), once, with the parameters the server
 * returned from the stored action.
 */
const SignVote: FC<SignVoteProps> = ({ sign, authToken, onDone }) => {
  const t = useTranslations('ApproveAction');
  const { handleAccept, handleReject } = useVote({
    proposalId: sign.web3ProposalId,
    authToken,
  });
  const latest = useRef({ handleAccept, handleReject });
  latest.current = { handleAccept, handleReject };
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          const run = sign.support
            ? latest.current.handleAccept
            : latest.current.handleReject;
          const hash = await run();
          onDone(hash);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!WALLET_NOT_READY.test(message) || attempt === 19) {
            console.error('Approval signing failed', message);
            onDone(null);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
    })();
  }, [sign.support, onDone]);

  return (
    <>
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      <p className="text-3 font-semibold text-foreground">
        {t('signingTitle')}
      </p>
      <p className="max-w-md text-2 text-muted-foreground">
        {t('signingDescription')}
      </p>
    </>
  );
};

/**
 * Approval page (spike, #2515 milestone 04b). The summary comes from the
 * server (built from the stored action); this page never shows text taken from
 * the URL or from the client application.
 */
export const ApproveActionPage: FC<{ actionId: string }> = ({ actionId }) => {
  const t = useTranslations('ApproveAction');
  const { isAuthenticated, isLoading, getAccessToken, login, logout } =
    useAuthentication();
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const accessToken = await getAccessToken();
      return fetch(`${API}/${encodeURIComponent(actionId)}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken ?? ''}`,
        },
      });
    },
    [actionId, getAccessToken],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setState({ step: 'signed-out' });
      return;
    }
    // Load once per page visit: a later identity change of `call` must not
    // reset a request that is already being signed.
    if (loaded.current) return;
    loaded.current = true;
    void (async () => {
      try {
        setToken((await getAccessToken()) ?? null);
        const res = await call('');
        if (res.status === 404) return setState({ step: 'not-found' });
        if (!res.ok) return setState({ step: 'error' });
        const action = (await res.json()) as ActionView;
        if (action.status === 'pending') {
          setState({ step: 'review', action });
        } else if (action.status === 'expired') {
          setState({ step: 'final', outcome: 'expired' });
        } else if (action.status === 'rejected') {
          setState({ step: 'final', outcome: 'rejected' });
        } else if (action.status === 'failed') {
          setState({ step: 'final', outcome: 'failed' });
        } else if (action.status === 'submitted') {
          setState({ step: 'final', outcome: 'submitted' });
        } else {
          setState({ step: 'final', outcome: 'used' });
        }
      } catch {
        setState({ step: 'error' });
      }
    })();
  }, [isLoading, isAuthenticated, call, getAccessToken]);

  const answer = useCallback(
    async (kind: 'approve' | 'reject') => {
      setBusy(true);
      try {
        const res = await call(`/${kind}`, { method: 'POST' });
        if (res.status === 404) return setState({ step: 'not-found' });
        if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as {
            status?: string;
          };
          return setState({
            step: 'final',
            outcome: body.status === 'expired' ? 'expired' : 'used',
          });
        }
        if (!res.ok) return setState({ step: 'error' });
        if (kind === 'reject') {
          return setState({ step: 'final', outcome: 'rejected' });
        }
        const body = (await res.json()) as { sign: SignRequest };
        setState({ step: 'signing', sign: body.sign });
      } catch {
        setState({ step: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [call],
  );

  const onSigned = useCallback(
    async (hash: string | null) => {
      const body = hash
        ? { outcome: 'submitted', txHash: hash }
        : { outcome: 'failed' };
      try {
        await call('/result', { method: 'POST', body: JSON.stringify(body) });
      } catch {
        // The wallet result stands; the client keeps seeing `approved` until a retry.
      }
      setState({ step: 'final', outcome: hash ? 'submitted' : 'failed' });
    },
    [call],
  );

  const finalCopy = {
    submitted: { title: t('submittedTitle'), text: t('submittedDescription') },
    rejected: { title: t('rejectedTitle'), text: t('rejectedDescription') },
    expired: { title: t('expiredTitle'), text: t('expiredDescription') },
    used: { title: t('usedTitle'), text: t('usedDescription') },
    failed: { title: t('failedTitle'), text: t('failedDescription') },
  } as const;

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      {state.step === 'loading' && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-3 font-semibold text-foreground">
            {t('loadingTitle')}
          </p>
        </>
      )}
      {state.step === 'signed-out' && (
        <>
          <p className="text-3 font-semibold text-foreground">
            {t('signInTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {t('signInDescription')}
          </p>
          <Button onClick={() => void login()}>{t('signInButton')}</Button>
        </>
      )}
      {state.step === 'not-found' && (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-3 font-semibold text-foreground">
            {t('notFoundTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {t('notFoundDescription')}
          </p>
          <Button variant="outline" onClick={() => void logout(false)}>
            {t('signOutButton')}
          </Button>
        </>
      )}
      {state.step === 'error' && (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-3 font-semibold text-foreground">
            {t('errorTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {t('errorDescription')}
          </p>
        </>
      )}
      {state.step === 'review' && (
        <>
          <p className="text-3 font-semibold text-foreground">
            {t('reviewTitle')}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {state.action.summary.headline}
          </p>
          <dl className="w-full max-w-md divide-y divide-border rounded-md border border-border text-left">
            {state.action.summary.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4 p-3">
                <dt className="text-2 text-muted-foreground">{line.label}</dt>
                <dd className="text-2 font-medium text-foreground">
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="max-w-md text-1 text-muted-foreground">
            {t('reviewDescription')}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer('reject')}
            >
              {t('rejectButton')}
            </Button>
            <Button disabled={busy} onClick={() => void answer('approve')}>
              {t('approveButton')}
            </Button>
          </div>
        </>
      )}
      {state.step === 'signing' && (
        <SignVote sign={state.sign} authToken={token} onDone={onSigned} />
      )}
      {state.step === 'final' && (
        <>
          {state.outcome === 'submitted' ? (
            <CheckCircle2 className="h-10 w-10 text-success-9" />
          ) : (
            <XCircle className="h-10 w-10 text-destructive" />
          )}
          <p className="text-3 font-semibold text-foreground">
            {finalCopy[state.outcome].title}
          </p>
          <p className="max-w-md text-2 text-muted-foreground">
            {finalCopy[state.outcome].text}
          </p>
          <Button variant="outline" onClick={() => window.close()}>
            {t('closeButton')}
          </Button>
        </>
      )}
    </Container>
  );
};
