'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

export function isStripeSubscriptionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_STRIPE_SUBSCRIPTIONS === 'true';
}

export type StripeSubscriptionStatus = {
  hasActiveSubscription: boolean;
  mySubscription: {
    id: number;
    status: 'incomplete' | 'active' | 'past_due' | 'canceled';
    createdAt: string;
  } | null;
};

function getSubscriptionEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/subscription`;
}

async function postForUrl(
  endpoint: string,
  token: string,
  lang: string,
  urlKey: 'checkoutUrl' | 'portalUrl',
): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lang }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof body.error === 'string'
        ? body.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  const url = body[urlKey];
  if (typeof url !== 'string') {
    throw new Error('Missing redirect URL in response');
  }
  return url;
}

export const useStripeSubscription = ({
  spaceSlug,
  lang,
}: {
  spaceSlug: string;
  lang: string;
}) => {
  const { getAccessToken, isAuthenticated } = useAuthentication();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const enabled = isStripeSubscriptionsEnabled();

  const { data: subscription, isLoading } = useSWR(
    enabled && isAuthenticated && spaceSlug
      ? [getSubscriptionEndpoint(spaceSlug), 'stripe-subscription']
      : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as StripeSubscriptionStatus;
    },
  );

  const redirectTo = React.useCallback(
    async (
      path: 'checkout' | 'portal',
      urlKey: 'checkoutUrl' | 'portalUrl',
    ) => {
      setIsRedirecting(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Unauthorized');
        const url = await postForUrl(
          `${getSubscriptionEndpoint(spaceSlug)}/${path}`,
          token,
          lang,
          urlKey,
        );
        window.location.assign(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
        setIsRedirecting(false);
      }
    },
    [getAccessToken, spaceSlug, lang],
  );

  const startCheckout = React.useCallback(
    () => redirectTo('checkout', 'checkoutUrl'),
    [redirectTo],
  );
  const openBillingPortal = React.useCallback(
    () => redirectTo('portal', 'portalUrl'),
    [redirectTo],
  );

  return {
    enabled,
    subscription: subscription ?? null,
    isLoading,
    isRedirecting,
    error,
    startCheckout,
    openBillingPortal,
  };
};
