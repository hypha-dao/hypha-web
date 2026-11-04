import { requireAuthServerHost } from '../_lib/host-gate';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hypha - Connect an app' };

export default async function AuthServerLoginPage() {
  await requireAuthServerHost();
  return <LoginClient />;
}
