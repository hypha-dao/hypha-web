import { flag } from '@vercel/flags/next';
import {
  HYPHA_AUTH_PROVIDER,
  HYPHA_SHOW_LANGUAGE_SELECT,
} from '@hypha-platform/cookie';

export const enableWeb3Auth = flag<boolean>({
  key: 'enable-web3-auth',
  decide({ cookies }) {
    return cookies.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
  },
});

export const showLanguageSelect = flag<boolean>({
  key: 'show-language-select',
  defaultValue: false,
  description: 'Show the i18n language select button in the menu bar',
  decide({ cookies }) {
    return cookies.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value === 'true';
  },
});
