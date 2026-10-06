import 'server-only';

import type { BankProvider } from '../../types';
import { bankProviderManifest } from './manifest';

function envVarNameFor(provider: BankProvider): string {
  return `BANKING_PROVIDER_ENABLED_CURRENCIES_${provider.toUpperCase()}`;
}

/**
 * Currencies the registry will actually route to `provider` — the Enablement layer (D1). Sits
 * between the code-level Capability layer (`bankProviderManifest[provider].supportedCurrencies`)
 * and the client-side UI-gating layer (`NEXT_PUBLIC_BANKING_SUPPORTED_*_RAILS`).
 *
 * - `BANKING_PROVIDER_ENABLED_CURRENCIES_<PROVIDER>` **unset** → permissive: every currency the
 *   adapter declares in the manifest.
 * - **set** (comma-separated), including to an empty string → exactly the listed currencies. An
 *   empty value therefore disables all routing to this provider without unregistering it.
 */
export function getEnabledCurrenciesForProvider(
  provider: BankProvider,
): string[] {
  const raw = process.env[envVarNameFor(provider)];
  if (raw === undefined) {
    return [...bankProviderManifest[provider].supportedCurrencies];
  }
  return raw
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter((code) => code.length > 0);
}
