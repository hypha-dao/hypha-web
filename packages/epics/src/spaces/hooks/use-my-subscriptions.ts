'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import {
  isStripeSubscriptionsEnabled,
  postForUrl,
} from './use-stripe-subscription';

const MY_SUBSCRIPTIONS_ENDPOINT = '/api/v1/me/subscriptions';

export type MySpaceSubscription = {
  id: number;
  status: 'incomplete' | 'active' | 'past_due' | 'canceled';
  createdAt: string;
  spaceSlug: string;
  spaceTitle: string;
};

export type MySubscriptions = {
  hasSubscriptions: boolean;
  subscriptions: MySpaceSubscription[];
};

/**
 * The caller's card subscriptions across all spaces, plus a redirect to the
 * Stripe Customer Portal where every one of them can be managed or canceled.
 * Unlike `useStripeSubscription` this is not tied to a space page.
 */
export const useMySubscriptions = ({ lang }: { lang: string }) => {
  const { getAccessToken, isAuthenticated } = useAuthentication();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const enabled = isStripeSubscriptionsEnabled();

  const { data, isLoading } = useSWR(
    enabled && isAuthenticated
      ? [MY_SUBSCRIPTIONS_ENDPOINT, 'my-subscriptions']
      : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as MySubscriptions;
    },
  );

  const openBillingPortal = React.useCallback(async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Unauthorized');
      const url = await postForUrl(
        `${MY_SUBSCRIPTIONS_ENDPOINT}/portal`,
        token,
        lang,
        'portalUrl',
      );
      window.location.assign(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      console.error('Stripe billing portal failed:', message);
      setError(message);
      setIsRedirecting(false);
    }
  }, [getAccessToken, lang]);

  return {
    enabled,
    hasSubscriptions: data?.hasSubscriptions ?? false,
    subscriptions: data?.subscriptions ?? [],
    isLoading,
    isRedirecting,
    error,
    openBillingPortal,
  };
};
