'use client';
// SPIKE #2616: minimal sign-in control to test Privy on the partner origin (S4/S5/S6).
import { useAuthentication } from '@hypha-platform/authentication';

export function WlAuth() {
  const { isAuthenticated, isLoading, login, logout } = useAuthentication();
  if (isLoading) return <span className="text-sm">auth: loading…</span>;
  return (
    <span className="ml-auto flex items-center gap-2 text-sm">
      <span data-testid="wl-auth-state">
        auth: {isAuthenticated ? 'signed in' : 'signed out'}
      </span>
      {isAuthenticated ? (
        <button type="button" className="underline" onClick={() => logout()}>
          sign out
        </button>
      ) : (
        <button type="button" className="underline" onClick={() => login()}>
          sign in
        </button>
      )}
    </span>
  );
}
