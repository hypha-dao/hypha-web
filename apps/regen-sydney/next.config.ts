import type { NextConfig } from 'next';

/**
 * Standalone Regen Sydney campaign app. Deliberately shares nothing with
 * `apps/web` at runtime — its own domain, its own database, its own deploy.
 *
 * The only things it has in common with the platform are the Privy app, so a
 * contributor's identity lines up, and read-only lookups against Hypha's
 * public API. It holds no credential for Hypha and imports none of its
 * runtime packages, so nothing here can write to the platform database.
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
