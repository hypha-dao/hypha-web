import { requireAuthServerHost } from '../_lib/host-gate';
import { AuthIntlProvider, langParam, loadAuthIntl } from '../_lib/intl';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hypha - Connect an app' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuthServerLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAuthServerHost();
  const intl = await loadAuthIntl({ lang: langParam(await searchParams) });
  return (
    <AuthIntlProvider intl={intl}>
      <LoginClient />
    </AuthIntlProvider>
  );
}
