import type { JSONWebKeySet } from 'jose';
import { ServerAuthAdapter, JWKSProvider } from '../types';

export interface PrivyServerConfig {
  appId: string;
}

export class PrivyServerAdapter implements ServerAuthAdapter {
  constructor(private config: PrivyServerConfig) {}

  jwks: JWKSProvider = {
    getJWKSUrl: (): string =>
      `https://auth.privy.io/api/v1/apps/${this.config.appId}/jwks.json`,

    fetchJWKS: async (): Promise<JSONWebKeySet> => {
      const response = await fetch(this.jwks.getJWKSUrl());
      if (!response.ok) {
        throw new Error('Failed to fetch Privy JWKS');
      }
      return response.json();
    },
  };
}
