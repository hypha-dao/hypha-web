import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { blockUnlessAuthServerHost } from '@hypha-platform/auth-server/server';
import { getAuthServerConfig } from './server';

/**
 * Pages of the authorization server answer only on its own host (and only while it is on).
 * Anywhere else they are a plain 404, like the protocol routes.
 */
export async function requireAuthServerHost() {
  const config = getAuthServerConfig();
  const h = await headers();
  const probe = new Request('http://localhost/', {
    headers: { host: h.get('host') ?? '' },
  });
  if (blockUnlessAuthServerHost(probe, config) || !config.enabled) notFound();
  return config;
}
