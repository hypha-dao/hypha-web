'use client';

import * as React from 'react';
import type { PlatformDashboardData } from '@hypha-platform/core/client';

export function usePlatformDashboardAuth() {
  const [secretInput, setSecretInput] = React.useState('');
  const [activeSecret, setActiveSecret] = React.useState<string | null>(null);

  const fetchDashboard = React.useCallback(async () => {
    if (!activeSecret) {
      throw new Error('Ops secret is required');
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
        throw new Error(
          'Platform dashboard API is not configured on this environment (HYPHA_SPACE_MEMORY_OPS_SECRET missing).',
        );
      }
      if (response.status === 401) {
        throw new Error('Invalid ops secret. Check the value and try again.');
      }
      if (!response.ok) {
        throw new Error(`Failed to load dashboard (${response.status})`);
      }
      setData((await response.json()) as PlatformDashboardData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load dashboard',
      );
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
