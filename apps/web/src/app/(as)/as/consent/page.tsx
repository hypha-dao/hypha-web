import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadConsentRequest } from '@hypha-platform/auth-server/server';
import { requireAuthServerHost } from '../_lib/host-gate';
import { getAuthServer } from '../_lib/server';
import { ConsentForm } from './consent-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hypha - Approve app' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}...` : value;

export default async function AuthServerConsentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const config = await requireAuthServerHost();
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const values = Array.isArray(value)
      ? value
      : value === undefined
      ? []
      : [value];
    for (const v of values) query.append(key, v);
  }
  const request = await loadConsentRequest(
    getAuthServer(config),
    new Headers(await headers()),
    query.toString(),
  );
  if (!request) {
    // Unsigned, expired or no session: start over from the app.
    redirect('/as/login?error=expired');
  }
  return (
    <ConsentForm
      oauthQuery={request.oauthQuery}
      personName={clip(request.person.name, 80)}
      client={{
        name: clip(request.client.name, 80),
        host: clip(request.client.host, 120),
        redirectHost: clip(request.client.redirectHost, 120),
      }}
      scopes={request.scopes}
    />
  );
}
