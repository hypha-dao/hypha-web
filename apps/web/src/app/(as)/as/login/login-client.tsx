'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { AUTH_SERVER_API_BASE_PATH } from '@hypha-platform/auth-server/client';

type Phase = 'idle' | 'signing-in' | 'denied' | 'failed';

/**
 * Login page of the authorization server. The person signs in with Privy on this host (a
 * top-level page or popup, so no third-party cookies are involved). The Privy token is sent
 * once to this server, which verifies it and opens its own session; the token is never kept
 * and never given to the app that asked.
 */
export function LoginClient() {
  const { isAuthenticated, isLoading, openLoginModal, getAccessToken, logout } =
    useAuthentication();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [message, setMessage] = React.useState<string>('');
  const started = React.useRef(false);

  const signIn = React.useCallback(async () => {
    setPhase('signing-in');
    try {
      const privyToken = await getAccessToken();
      if (!privyToken) throw new Error('no token');
      const res = await fetch(`${AUTH_SERVER_API_BASE_PATH}/privy/sign-in`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          privyToken,
          oauth_query: window.location.search.replace(/^\?/, ''),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
      };
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      if (res.status === 403) {
        setMessage(
          body.message ?? 'This account is not enabled for this service.',
        );
        setPhase('denied');
        return;
      }
      setPhase('failed');
    } catch {
      setPhase('failed');
    }
  }, [getAccessToken]);

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
      <h1 className="text-4 font-medium">Connect an app to Hypha</h1>
      <p className="text-2 text-neutral-11">
        Sign in with your Hypha account to continue. You will see what the app
        asks for before anything is shared.
      </p>
      {phase === 'denied' ? (
        <>
          <p role="alert" className="text-2">
            {message}
          </p>
          <Button variant="outline" onClick={switchAccount}>
            Use a different account
          </Button>
        </>
      ) : phase === 'failed' ? (
        <>
          <p role="alert" className="text-2">
            Sign-in did not complete. Please try again.
          </p>
          <Button onClick={() => void signIn()}>Try again</Button>
        </>
      ) : (
        <Button
          onClick={() => (isAuthenticated ? void signIn() : openLoginModal())}
          disabled={isLoading || phase === 'signing-in'}
        >
          {phase === 'signing-in' ? 'Signing in...' : 'Sign in with Hypha'}
        </Button>
      )}
    </main>
  );
}
