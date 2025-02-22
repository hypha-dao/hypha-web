import type { JSONWebKeySet } from 'jose';

export interface JWKSProvider {
  getJWKSUrl(): string;
  fetchJWKS(): Promise<JSONWebKeySet>;
}

export interface MultiJWKSProvider extends JWKSProvider {
  getJWKSUrls(): Record<string, string>;
}

export interface ServerAuthAdapter {
  jwks: JWKSProvider | MultiJWKSProvider;
}
