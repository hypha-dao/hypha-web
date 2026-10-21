'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  buildIntegrationActionMessage,
  notifyOpener,
  useVote,
} from '@hypha-platform/core/client';
import { Button, Container } from '@hypha-platform/ui';
import { setPopupClient } from '@web/components/popup-route-gate';

type ActionView = {
  status:
    | 'pending'
    | 'approved'
    | 'submitted'
    | 'rejected'
    | 'expired'
    | 'failed';
  summary: { headline: string; lines: { label: string; value: string }[] };
  client: { name: string; origins: string[]; logoUrl: string | null };
  txHash: string | null;
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

type FinalOutcome = Extract<PageState, { step: 'final' }>['outcome'];

/** Outcomes the application is told about; `used` has no result of its own. */
const REPORTED: Partial<
  Record<FinalOutcome, 'submitted' | 'rejected' | 'failed' | 'expired'>
> = {
  submitted: 'submitted',
  rejected: 'rejected',
  failed: 'failed',
  expired: 'expired',
};

/** After these the window goes back to the application by itself. */
const AUTO_CLOSE: FinalOutcome[] = ['submitted', 'rejected'];

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
export const ApproveActionPage: FC<{
  actionId: string;
  /** Wait before the window closes itself after done or cancel; 0 disables. */
  closeAfterSeconds: number;
}> = ({ actionId, closeAfterSeconds }) => {
  const t = useTranslations('ApproveAction');
  const { isAuthenticated, isLoading, getAccessToken, login, logout } =
    useAuthentication();
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  // What the application is told when the request ends (see `notifyOpener`).
  const origins = useRef<string[]>([]);
  const txHash = useRef<string | null>(null);
  const notified = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);

  // The header shows the client only while this page is open.
  useEffect(() => () => setPopupClient(null), []);

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
        origins.current = action.client.origins;
        setPopupClient({
          name: action.client.name,
          logoUrl: action.client.logoUrl,
        });
        txHash.current = action.txHash;
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
      txHash.current = hash;
      try {
        await call('/result', { method: 'POST', body: JSON.stringify(body) });
      } catch {
        // The wallet result stands; the client keeps seeing `approved` until a retry.
      }
      setState({ step: 'final', outcome: hash ? 'submitted' : 'failed' });
    },
    [call],
  );

  const finalOutcome = state.step === 'final' ? state.outcome : null;

  // Tell the application first (once), then, if configured, count down and close.
  useEffect(() => {
    if (!finalOutcome || notified.current) return;
    const status = REPORTED[finalOutcome];
    if (!status) return;
    notified.current = true;
    notifyOpener(
      typeof window === 'undefined' ? null : window.opener,
      buildIntegrationActionMessage({
        actionId,
        status,
        txHash: txHash.current,
      }),
      origins.current,
    );
  }, [finalOutcome, actionId]);

  useEffect(() => {
    if (!finalOutcome || !AUTO_CLOSE.includes(finalOutcome)) return;
    if (closeAfterSeconds <= 0) return;
    setSecondsLeft(closeAfterSeconds);
    const timer = setInterval(
      () => setSecondsLeft((left) => (left === null ? left : left - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [finalOutcome, closeAfterSeconds]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    // Only a window opened by a script can close itself; otherwise say so.
    window.close();
    setCloseBlocked(true);
  }, [secondsLeft]);

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
          <p className="max-w-md text-1 text-muted-foreground">
            {state.action.client.origins.length > 0
              ? t('requestedFrom', {
                  name: state.action.client.name,
                  origins: state.action.client.origins.join(', '),
                })
              : t('requestedFromUnregistered', {
                  name: state.action.client.name,
                })}
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
          {secondsLeft !== null && secondsLeft > 0 && (
            <p className="text-2 text-muted-foreground">
              {t('closeCountdown', { seconds: secondsLeft })}
            </p>
          )}
          {closeBlocked && (
            <p className="max-w-md text-2 text-muted-foreground">
              {t('closeBlocked')}
            </p>
          )}
          <Button variant="outline" onClick={() => window.close()}>
            {t('closeButton')}
          </Button>
        </>
      )}
    </Container>
  );
};
