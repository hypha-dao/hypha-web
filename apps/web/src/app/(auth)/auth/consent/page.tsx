import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  decideConsentEntry,
  inspectConsentQuery,
  loadConsentRequest,
  separatePageLang,
} from '@hypha-platform/auth-server/server';
import { requireAuthServerHost } from '../_lib/host-gate';
import { getAuthServer } from '../_lib/server';
import { AuthIntlProvider, authTranslator, loadAuthIntl } from '../_lib/intl';
import { ConsentForm } from './consent-form';
import { loadPickerSpaces } from './own-spaces';

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
  // `?lang=` is a page setting kept out of the signed authorization query.
  const separated = await separatePageLang(query.toString(), config.secret);
  const intl = await loadAuthIntl({ lang: separated.lang });
  const t = authTranslator(intl);
  const signedQuery = separated.query;

  const server = getAuthServer(config);
  const requestHeaders = new Headers(await headers());
  const state = await inspectConsentQuery(signedQuery, config.secret);
  const session =
    state === 'valid'
      ? await server.auth.api.getSession({ headers: requestHeaders })
      : null;
  const entry = decideConsentEntry(state, Boolean(session));
  // A valid link without a session keeps its signed query through sign-in. An expired or
  // invalid link never goes to sign-in: it could not be used afterwards.
  if (entry === 'sign-in') {
    const login = new URLSearchParams(signedQuery);
    if (separated.lang) login.set('lang', separated.lang);
    redirect(`/auth/login?${login.toString()}`);
  }
  if (entry === 'expired' || entry === 'restart') {
    return (
      <AuthIntlProvider intl={intl}>
        <RestartMessage
          title={
            entry === 'expired'
              ? t('approval.expiredTitle')
              : t('approval.invalidTitle')
          }
          message={
            entry === 'expired' ? t('approval.expired') : t('approval.invalid')
          }
        />
      </AuthIntlProvider>
    );
  }
  const request = await loadConsentRequest(server, requestHeaders, signedQuery);
  if (!request) {
    // Signed and signed in, but the app is unknown here: nothing to approve.
    return (
      <AuthIntlProvider intl={intl}>
        <RestartMessage
          title={t('approval.invalidTitle')}
          message={t('approval.invalid')}
        />
      </AuthIntlProvider>
    );
  }
  // Only for an app that asks to read spaces; the read can fail, then only "all" is offered.
  const asksToRead = request.scopes.some((s) => s.scope === 'spaces:read');
  const pickerSpaces = asksToRead
    ? await loadPickerSpaces(request.person.id)
    : null;
  return (
    <AuthIntlProvider intl={intl}>
      <ConsentForm
        oauthQuery={request.oauthQuery}
        personId={request.person.id}
        personName={clip(request.person.name, 80)}
        client={{
          kind: request.client.kind,
          name: clip(request.client.name, 80),
          // Never clipped: a cut-off host would show an address that is not the real one.
          host: request.client.host,
          redirectHost: request.client.redirectHost,
        }}
        scopes={request.scopes}
        pickerSpaces={pickerSpaces}
      />
    </AuthIntlProvider>
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
