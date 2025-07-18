'use client';

import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';
import { useEffect, useState } from 'react';
import { Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

type ButtonSigninMobileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
  // newUserRedirectPath: string;
  mobileRedirectUrl: string;
};

type ErrorUser = {
  error: string;
};

const isErrorUser = (obj: any): obj is ErrorUser => {
  return obj && typeof obj === 'object' && 'error' in obj;
};

export const ButtonSigninMobile = ({
  useAuthentication,
  useMe,
  // newUserRedirectPath,
  mobileRedirectUrl,
}: ButtonSigninMobileProps) => {
  const {
    isAuthenticated,
    logout,
    login,
    isLoggingIn,
    setLoggingIn,
    user,
    isLoading: isAuthLoading,
    getAccessToken,
    isModalOpen,
  } = useAuthentication();
  const { person, isLoading: isPersonLoading } = useMe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [shouldRedirect, setShouldRedirect] = useState<boolean>(false);

  useEffect(() => {
    setLoading(false);
    // Modal open and close before getting the token and after reloading on signin
    // It should redirect if user exists and model was opened
    if (isModalOpen) {
      setShouldRedirect(true);
    }
    if (isAuthLoading || isPersonLoading || isModalOpen) {
      setError(null);
      setLoading(true);
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (!mobileRedirectUrl) {
      setError('Mobile redirect URL is not configured.');
      return;
    }

    const handleUserRedirect = async () => {
      try {
        if (user) {
          if (person) {
            if (isErrorUser(person)) {
              setError(person.error);
            } else {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                setToken(null);
                setError('Failed to retrieve access token.');
                return;
              }
              setToken(accessToken);
              if (shouldRedirect) {
                window.location.href = `${mobileRedirectUrl}?token=${accessToken}`;
              }
            }
          } else {
            logout(false);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error during user redirect:', err);
        setError('An error occurred while processing your request.');
        setLoading(false);
      }
    };

    handleUserRedirect();
  }, [
    isPersonLoading,
    isAuthLoading,
    isAuthenticated,
    // person, // TODO: will be fixed within the framework #868
    user,
    mobileRedirectUrl,
    isLoggingIn,
    setLoggingIn,
    isModalOpen,
  ]);

  const handleSignOut = async () => {
    setShouldRedirect(false);
    setToken(null);
    setError(null);
    logout(false);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center gap-4">
      {(!isAuthenticated || loading || error) && (
        <Button
          onClick={() => login()}
          className="flex gap-2"
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin w-4 h-4" />}
          <span>Sign in</span>
        </Button>
      )}
      {isAuthenticated && !loading && !error && (
        <Button
          variant="outline"
          colorVariant="error"
          onClick={handleSignOut}
          className="flex gap-2"
        >
          <span>Sign out</span>
        </Button>
      )}
      {isAuthenticated && loading && shouldRedirect && (
        <p className="text-muted-foreground">Redirecting...</p>
      )}
      {isAuthenticated && !loading && !error && person && (
        <p className="text-muted-foreground">
          You are signed in as {person.name}
        </p>
      )}
      {error && <p className="text-error-11">{error}</p>}
      <Button variant="link" asChild>
        <Link
          href={
            token ? `${mobileRedirectUrl}?token=${token}` : mobileRedirectUrl
          }
        >
          Return to the app
        </Link>
      </Button>
    </div>
  );
};
