import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  initialSpaceChoice,
  isPersonAllowed,
  listConnectedApps,
} from '@hypha-platform/auth-server/server';
import { describeScope } from '@hypha-platform/auth-server/client';
import { requireAuthServerHost } from '../_lib/host-gate';
import { getAuthServer } from '../_lib/server';
import {
  AuthIntlProvider,
  authTranslator,
  langParam,
  loadAuthIntl,
} from '../_lib/intl';
import { loadPickerSpaces } from '../consent/own-spaces';
import { ConnectedAppsList, type AppView } from './apps-list';
import { CONNECTED_APPS_PAGE } from './paths';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hypha - Connected apps' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}...` : value;

const hostOf = (value: string | null | undefined) => {
  try {
    return value ? new URL(value).host : '';
  } catch {
    return '';
  }
};

/**
 * The person's connected AI apps, on the authorization server's own host: what each may do and
 * in which spaces, with "Change spaces" and "Disconnect". Read on the server for the signed-in
 * person only. Client ids are never sent to the page: an app is named by its consent record id.
 */
export default async function ConnectedAppsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const config = await requireAuthServerHost();
  const raw = await searchParams;
  const lang = langParam(raw);
  const intl = await loadAuthIntl({ lang });
  const t = authTranslator(intl);
  const server = getAuthServer(config);
  const session = await server.auth.api.getSession({
    headers: new Headers(await headers()),
  });
  if (!session) {
    const login = new URLSearchParams({ next: CONNECTED_APPS_PAGE });
    if (lang) login.set('lang', lang);
    redirect(`/auth/login?${login.toString()}`);
  }
  const personId = session.user.id;
  if (!isPersonAllowed(config, personId)) {
    return (
      <AuthIntlProvider intl={intl}>
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
          <h1 className="text-4 font-medium">{t('apps.title')}</h1>
          <p role="alert" className="text-2">
            {t('login.denied.notEnabled')}
          </p>
        </main>
      </AuthIntlProvider>
    );
  }

  const apps = await listConnectedApps(server.pool, personId);
  const anyReads = apps.some((app) => app.scopes.includes('spaces:read'));
  const pickerSpaces = anyReads ? await loadPickerSpaces(personId) : null;
  const pickerIds = pickerSpaces ? pickerSpaces.map((space) => space.id) : null;
  const date = new Intl.DateTimeFormat(intl.locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });

  const views: AppView[] = apps.map((app) => {
    // No stored grant means the app reads nothing: the picker starts with nothing chosen.
    const current =
      app.spaces === null
        ? []
        : app.spaces === 'all'
        ? ('all' as const)
        : app.spaces.map((space) => space.id);
    return {
      id: app.id,
      name: clip(app.name || hostOf(app.clientId) || t('apps.unnamed'), 80),
      kind: app.kind,
      // The proven host for an app identified by its metadata document; the app's own link for
      // one Hypha registered; nothing for one that registered itself (its link is a claim).
      host:
        app.kind === 'cimd'
          ? hostOf(app.clientId)
          : app.kind === 'registered'
          ? hostOf(app.uri)
          : '',
      scopes: app.scopes.map((scope) => ({
        scope,
        copyKey: describeScope(scope).key,
      })),
      reads: app.scopes.includes('spaces:read'),
      writes: app.scopes.includes('signals:write'),
      spaces:
        app.spaces === null || app.spaces === 'all'
          ? app.spaces
          : app.spaces.map((space) => ({ id: space.id, title: space.title })),
      connectedOn: date.format(app.connectedAt),
      lastActiveOn: app.lastActiveAt ? date.format(app.lastActiveAt) : null,
      initialSpaces: initialSpaceChoice(current, pickerIds),
    };
  });

  return (
    <AuthIntlProvider intl={intl}>
      <ConnectedAppsList
        personId={personId}
        personName={clip(session.user.name, 80)}
        apps={views}
        pickerSpaces={pickerSpaces}
      />
    </AuthIntlProvider>
  );
}
