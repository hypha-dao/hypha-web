'use client';

import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';
import { useEffect, useState } from 'react';
import {
  Button,
} from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';

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
    getAccessToken
  } = useAuthentication();
  const { person, isLoading: isPersonLoading } = useMe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || isPersonLoading) {
      setError(null);
      setLoading(true);
      return;
    }
    if(!isAuthenticated) {
      return
    }

    if(!mobileRedirectUrl) {
      setError('Mobile redirect URL is not configured.');
      setLoading(false);
      return;
    }

    const handleUserRedirect = async () => {
      try {
        if (user) {
          if (person) {
            setLoading(true);
            if (isErrorUser(person)) {
              setError(person.error);
              setLoading(false);
            } else if (!isLoggingIn){
              const token = await getAccessToken();
              if (!token) {
                setError('Failed to retrieve access token.');
                setLoading(false);
                return;
              }
              window.location.href = `${mobileRedirectUrl}?token=${token}`;
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
    }

    handleUserRedirect()
  }, [
    isPersonLoading,
    isAuthLoading,
    isAuthenticated,
    // person, // TODO: will be fixed within the framework #868
    user,
    mobileRedirectUrl,
    isLoggingIn,
    setLoggingIn,
  ]);

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2">
      <Button
        onClick={login}
        className="flex gap-2"
        disabled={loading}
      >
        {
          loading && <Loader2 className="animate-spin w-4 h-4" />
        }
        <span>Sign in</span>
      </Button>
      {error && <p className="text-error-11">{error}</p>}
    </div>
  );
};
