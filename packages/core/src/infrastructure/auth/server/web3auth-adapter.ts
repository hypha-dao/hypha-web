import type { JSONWebKeySet } from 'jose';
import { ServerAuthAdapter, MultiJWKSProvider } from '../types';

export class Web3AuthServerAdapter implements ServerAuthAdapter {
  private readonly JWKS_URLS = {
    social: 'https://api-auth.web3auth.io/jwks',
    wallet: 'https://authjs.web3auth.io/jwks',
  } as const;

  jwks: MultiJWKSProvider = {
    getJWKSUrl: () => this.JWKS_URLS.social, // Default to social
    getJWKSUrls: () => this.JWKS_URLS,
    fetchJWKS: async (): Promise<JSONWebKeySet> => {
      const [socialJwks, walletJwks] = await Promise.all([
        fetch(this.JWKS_URLS.social).then((res) => res.json()),
        fetch(this.JWKS_URLS.wallet).then((res) => res.json()),
      ]);

      return {
        keys: [...(socialJwks.keys || []), ...(walletJwks.keys || [])],
      };
    },
  };
}
