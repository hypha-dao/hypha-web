import { flag } from '@vercel/flags/next';
import { HYPHA_AUTH_PROVIDER } from '@hypha-platform/cookie';

export const enableWeb3Auth = flag<boolean>({
  key: 'enable-web3-auth',
  decide({ cookies }) {
    return cookies.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
  },
});
