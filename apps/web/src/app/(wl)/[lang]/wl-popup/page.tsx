'use client';
// SPIKE #2616 S5 (Q5.3): first-party popup login. Opened with window.open from the test parent
// page on the same origin; posts the login result back with postMessage. Throwaway.
import { useEffect } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

export default function WlPopupPage() {
  const { isAuthenticated, isLoading, user, login } = useAuthentication();
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    window.opener?.postMessage(
      { type: 'spike-login', userId: user.id, at: Date.now() },
      window.location.origin,
    );
  }, [isLoading, isAuthenticated, user]);
  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <p data-testid="popup-state">
        popup auth:{' '}
        {isLoading ? 'loading' : isAuthenticated ? 'signed in' : 'signed out'}
      </p>
      {!isAuthenticated && !isLoading ? (
        <button type="button" onClick={() => login()}>
          sign in (popup)
        </button>
      ) : null}
      {isAuthenticated ? (
        <button type="button" onClick={() => window.close()}>
          close
        </button>
      ) : null}
    </main>
  );
}
