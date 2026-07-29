'use client';

import * as React from 'react';
import type { PlatformDashboardData } from '@hypha-platform/core/client';

export function usePlatformDashboardAuth() {
  const [secretInput, setSecretInput] = React.useState('');
  const [activeSecret, setActiveSecret] = React.useState<string | null>(null);

  const fetchDashboard = React.useCallback(async () => {
    if (!activeSecret) {
      throw new Error('secret_required');
    }
    return fetch('/api/v1/ops/platform/dashboard', {
      headers: {
        'x-hypha-ops-secret': activeSecret,
      },
    });
  }, [activeSecret]);

  const authenticate = React.useCallback(() => {
    const trimmed = secretInput.trim();
    if (trimmed) {
      setActiveSecret(trimmed);
    }
  }, [secretInput]);

  return {
    secretInput,
    setSecretInput,
    activeSecret,
    authenticate,
    fetchDashboard,
    isAuthenticated: Boolean(activeSecret),
  };
}

export function usePlatformDashboard(
  fetchDashboard: (() => Promise<Response>) | null,
) {
  const [data, setData] = React.useState<PlatformDashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!fetchDashboard) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchDashboard();
      if (response.status === 503) {
        throw new Error('not_configured');
      }
      if (response.status === 401) {
        throw new Error('unauthorized');
      }
      if (!response.ok) {
        throw new Error('load_failed');
      }
      setData((await response.json()) as PlatformDashboardData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'load_failed');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboard]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { data, error, isLoading, refresh: load };
}
