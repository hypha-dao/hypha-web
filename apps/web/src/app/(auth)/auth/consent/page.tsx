import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  inspectConsentQuery,
  loadConsentRequest,
} from '@hypha-platform/auth-server/server';
import { requireAuthServerHost } from '../_lib/host-gate';
import { getAuthServer } from '../_lib/server';
import { APPROVAL_EXPIRED_MESSAGE } from '@hypha-platform/auth-server/client';
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
  if (
    (await inspectConsentQuery(query.toString(), config.secret)) === 'expired'
  ) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-4 font-medium">Approval expired</h1>
        <p role="alert" className="text-2">
          {APPROVAL_EXPIRED_MESSAGE}
        </p>
      </main>
    );
  }
  const request = await loadConsentRequest(
    getAuthServer(config),
    new Headers(await headers()),
    query.toString(),
  );
  if (!request) {
    // Unsigned, expired or no session: start over from the app.
    redirect('/auth/login?error=expired');
  }
  return (
    <ConsentForm
      oauthQuery={request.oauthQuery}
      personName={clip(request.person.name, 80)}
      client={{
        kind: request.client.kind,
        name: clip(request.client.name, 80),
        host: clip(request.client.host, 120),
        redirectHost: clip(request.client.redirectHost, 120),
      }}
      scopes={request.scopes}
    />
  );
}
