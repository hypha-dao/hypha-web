import 'server-only';

import type { BankProvider } from '../../types';
import { BankOnboardingError } from '../errors';
import { getEnabledCurrenciesForProvider } from './enabled-currencies';
import { BANK_PROVIDERS, bankProviderManifest } from './manifest';

/**
 * Resolve a currency to the provider that will service it: the provider whose manifest declares it
 * (Capability) **and** whose Enablement env allows it (D1). Throws on an unresolved currency — a
 * currency no enabled provider claims is a misconfiguration, never a silent Bridge fallback (D4).
 */
export function resolveProviderForCurrency(currency: string): BankProvider {
  const normalized = currency.trim().toLowerCase();

  const matches = BANK_PROVIDERS.filter((provider) => {
    const declared = bankProviderManifest[provider].supportedCurrencies.map(
      (code) => code.toLowerCase(),
    );
    if (!declared.includes(normalized)) {
      return false;
    }
    return getEnabledCurrenciesForProvider(provider)
      .map((code) => code.toLowerCase())
      .includes(normalized);
  });

  const [first, ...rest] = matches;
  if (!first) {
    throw new BankOnboardingError(
      `No enabled bank provider supports currency "${normalized}".`,
      422,
    );
  }
  if (rest.length > 0) {
    throw new BankOnboardingError(
      `Currency "${normalized}" resolves to multiple bank providers ` +
        `(${matches.join(', ')}); currency→provider is 1:1 today (D2) and ` +
        `disambiguation is not implemented.`,
      500,
    );
  }
  return first;
}

/**
 * Resolve the single provider for a set of onboarding rails/currencies. Every rail must land on
 * the same provider — one onboarding call = one provider = one `bank_customers` row (D3). A
 * request spanning providers is rejected here (fan-out is deferred; Flow 1 is AUD-only).
 */
export function resolveProviderForRails(
  rails: readonly string[],
): BankProvider {
  const resolved = rails.map((rail) => ({
    rail,
    provider: resolveProviderForCurrency(rail),
  }));

  const [first, ...rest] = resolved;
  if (!first) {
    throw new BankOnboardingError(
      'Cannot resolve a bank provider from an empty rail list.',
      422,
    );
  }
  if (rest.some((entry) => entry.provider !== first.provider)) {
    const detail = resolved
      .map((entry) => `${entry.rail}→${entry.provider}`)
      .join(', ');
    throw new BankOnboardingError(
      `Onboarding request spans multiple bank providers (${detail}); a single ` +
        `request must map to one provider.`,
      422,
    );
  }

  return first.provider;
}
