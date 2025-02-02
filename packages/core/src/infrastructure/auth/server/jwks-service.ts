import type { JSONWebKeySet } from 'jose';
import { ServerAuthAdapter } from '../types';

export class JWKSService {
  constructor(private adapters: ServerAuthAdapter[]) {}

  async getCombinedJWKS(): Promise<JSONWebKeySet> {
    const jwksSets = await Promise.all(
      this.adapters.map((adapter) => adapter.jwks.fetchJWKS()),
    );

    return {
      keys: jwksSets.flatMap((jwks) => jwks.keys || []),
    };
  }
}
