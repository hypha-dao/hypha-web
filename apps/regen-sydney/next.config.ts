import type { NextConfig } from 'next';

/**
 * Standalone Regen Sydney campaign app. Deliberately shares nothing with
 * `apps/web` at runtime — it is deployed to its own domain and linked to from
 * the Squarespace site. Hypha workspace packages can be added later for the
 * real backend (Privy auth, Postgres, the RSUT relayer) without changing this.
 */
const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/:path((?!api).*)*',
      headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
    },
  ],
};

export default nextConfig;
