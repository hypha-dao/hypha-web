'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { AUTH_SERVER_API_BASE_PATH } from '@hypha-platform/auth-server/client';

type Phase =
  | 'idle'
  | 'signing-in'
  | 'denied'
  | 'expired'
  | 'approval-expired'
  | 'unavailable'
  | 'failed';

type SignInBody = {
  url?: string;
  message?: string;
  error?: string;
  code?: string;
};

/**
 * Login page of the authorization server. The person signs in with Privy on this host (a
 * top-level page or popup, so no third-party cookies are involved). The Privy token is sent
 * once to this server, which verifies it and opens its own session; the token is never kept
 * and never given to the app that asked.
 */
export function LoginClient({
  next = null,
}: {
  /** Where to go after signing in when no app is asking (the connected-apps page). */
  next?: string | null;
} = {}) {
  const t = useTranslations('AuthServer');
  const { isAuthenticated, isLoading, openLoginModal, getAccessToken, logout } =
    useAuthentication();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [deniedKey, setDeniedKey] = React.useState<'notEnabled' | 'noProfile'>(
    'notEnabled',
  );
  const started = React.useRef(false);

  const signIn = React.useCallback(async () => {
    setPhase('signing-in');
    try {
      const privyToken = await getAccessToken();
      if (!privyToken) throw new Error('no token');
      const post = async (oauthQuery: string) => {
        const res = await fetch(
          `${AUTH_SERVER_API_BASE_PATH}/provider/sign-in`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              provider: 'privy',
              token: privyToken,
              oauth_query: oauthQuery,
            }),
          },
        );
        const body = (await res.json().catch(() => ({}))) as SignInBody;
        return { res, body };
      };
      // `?lang=` is a page setting, not part of the signed query: send the query without it. If
      // that does not verify, the app sent its own `lang` inside the signed query: send it whole.
      const original = window.location.search.replace(/^\?/, '');
      const params = new URLSearchParams(original);
      const hasLang = params.has('lang');
      params.delete('lang');
      // `next` is a page setting too; without an app asking there is no signed query at all.
      params.delete('next');
      let { res, body } = await post(params.toString());
      if (hasLang && body.error === 'invalid_signature') {
        ({ res, body } = await post(original));
      }
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      if (res.ok && next) {
        window.location.assign(next);
        return;
      }
      // The signed link from the app ran out; signing in again will not help, the app must restart.
      if (body.error === 'invalid_signature') {
        setPhase('approval-expired');
        return;
      }
      if (res.status === 403) {
        setDeniedKey(body.code === 'no_profile' ? 'noProfile' : 'notEnabled');
        setPhase('denied');
        return;
      }
      // Never say why beyond what the person can act on.
      if (res.status === 401) setPhase('expired');
      else if (res.status === 404 || res.status >= 500) setPhase('unavailable');
      else setPhase('failed');
    } catch {
      setPhase('failed');
    }
  }, [getAccessToken, next]);

  React.useEffect(() => {
    if (isLoading || !isAuthenticated || started.current) return;
    started.current = true;
    void signIn();
  }, [isLoading, isAuthenticated, signIn]);

  const switchAccount = async () => {
    started.current = false;
    setPhase('idle');
    await logout(false);
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-4 font-medium">
        {next ? t('apps.signInTitle') : t('login.title')}
      </h1>
      <p className="text-2 text-neutral-11">
        {next ? t('apps.signInIntro') : t('login.intro')}
      </p>
      {phase === 'denied' ? (
        <>
          <p role="alert" className="text-2">
            {t(`login.denied.${deniedKey}`)}
          </p>
          <p className="text-2 text-neutral-11">{t('login.denied.help')}</p>
          <Button variant="outline" onClick={switchAccount}>
            {t('login.useDifferentAccount')}
          </Button>
        </>
      ) : phase === 'approval-expired' ? (
        <p role="alert" className="text-2">
          {t('approval.expired')}
        </p>
      ) : phase === 'expired' ? (
        <>
          <p role="alert" className="text-2">
            {t('login.expired')}
          </p>
          <Button onClick={switchAccount}>{t('login.signInAgain')}</Button>
        </>
      ) : phase === 'unavailable' ? (
        <>
          <p role="alert" className="text-2">
            {t('login.unavailable')}
          </p>
          <Button variant="outline" onClick={() => void signIn()}>
            {t('login.tryAgain')}
          </Button>
        </>
      ) : phase === 'failed' ? (
        <>
          <p role="alert" className="text-2">
            {t('login.failed')}
          </p>
          <Button onClick={() => void signIn()}>{t('login.tryAgain')}</Button>
        </>
      ) : (
        <Button
          onClick={() => (isAuthenticated ? void signIn() : openLoginModal())}
          disabled={isLoading || phase === 'signing-in'}
        >
          {phase === 'signing-in' ? t('login.signingIn') : t('login.signIn')}
        </Button>
      )}
    </main>
  );
}
