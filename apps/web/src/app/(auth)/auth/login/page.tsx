import { requireAuthServerHost } from '../_lib/host-gate';
import { AuthIntlProvider, langParam, loadAuthIntl } from '../_lib/intl';
import { LoginClient } from './login-client';
import { CONNECTED_APPS_PAGE } from '../apps/paths';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hypha - Connect an app' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuthServerLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuthServerHost();
  const raw = await searchParams;
  const intl = await loadAuthIntl({ lang: langParam(raw) });
  // Where to go after signing in when no app is asking: only the connected-apps page.
  const next = raw.next === CONNECTED_APPS_PAGE ? CONNECTED_APPS_PAGE : null;
  return (
    <AuthIntlProvider intl={intl}>
      <LoginClient next={next} />
    </AuthIntlProvider>
  );
}
