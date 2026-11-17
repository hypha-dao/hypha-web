import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  decideConsentEntry,
  inspectConsentQuery,
  loadConsentRequest,
} from '@hypha-platform/auth-server/server';
import { requireAuthServerHost } from '../_lib/host-gate';
import { getAuthServer } from '../_lib/server';
import {
  APPROVAL_EXPIRED_MESSAGE,
  APPROVAL_INVALID_MESSAGE,
} from '@hypha-platform/auth-server/client';
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
  const server = getAuthServer(config);
  const requestHeaders = new Headers(await headers());
  const state = await inspectConsentQuery(query.toString(), config.secret);
  const session =
    state === 'valid'
      ? await server.auth.api.getSession({ headers: requestHeaders })
      : null;
  const entry = decideConsentEntry(state, Boolean(session));
  // A valid link without a session keeps its signed query through sign-in. An expired or
  // invalid link never goes to sign-in: it could not be used afterwards.
  if (entry === 'sign-in') redirect(`/auth/login?${query.toString()}`);
  if (entry === 'expired' || entry === 'restart') {
    return (
      <RestartMessage
        title={entry === 'expired' ? 'Approval expired' : 'Approval not valid'}
        message={
          entry === 'expired'
            ? APPROVAL_EXPIRED_MESSAGE
            : APPROVAL_INVALID_MESSAGE
        }
      />
    );
  }
  const request = await loadConsentRequest(
    server,
    requestHeaders,
    query.toString(),
  );
  if (!request) {
    // Signed and signed in, but the app is unknown here: nothing to approve.
    return (
      <RestartMessage
        title="Approval not valid"
        message={APPROVAL_INVALID_MESSAGE}
      />
    );
  }
  return (
    <ConsentForm
      oauthQuery={request.oauthQuery}
      personName={clip(request.person.name, 80)}
      client={{
        kind: request.client.kind,
        name: clip(request.client.name, 80),
        // Never clipped: a cut-off host would show an address that is not the real one.
        host: request.client.host,
        redirectHost: request.client.redirectHost,
      }}
      scopes={request.scopes}
    />
  );
}

function RestartMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-4 font-medium">{title}</h1>
      <p role="alert" className="text-2">
        {message}
      </p>
    </main>
  );
}
