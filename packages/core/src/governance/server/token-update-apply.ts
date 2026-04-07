import type { TokenUpdateData, UpdateTokenInput } from '../types';

/**
 * `token_updates.data` may duplicate `type` / `isVotingToken` for UI; those columns
 * on `tokens` are set at creation and must not be overwritten when applying a proposal.
 *
 * Only these keys from `TokenUpdateData` may flow into `updateToken` for apply flows.
 */
const TOKEN_UPDATE_APPLY_MUTABLE_KEYS = [
  'name',
  'symbol',
  'maxSupply',
  'transferable',
  'decayInterval',
  'decayPercentage',
  'referencePrice',
  'referenceCurrency',
  'archiveToken',
] as const satisfies readonly (keyof TokenUpdateData)[];

/**
 * Builds a partial {@link UpdateTokenInput} from pending proposal JSON using patch
 * semantics: only keys **present** on `data` are included (`Object.hasOwn`).
 * Excludes `type` and `isVotingToken`. For `iconUrl`, uses the same rule as legacy
 * apply behavior (only when the key exists on the object).
 */
export function buildUpdateTokenInputPatchFromTokenUpdateData(
  data: TokenUpdateData,
): Partial<UpdateTokenInput> {
  const out: Partial<UpdateTokenInput> = {};

  for (const key of TOKEN_UPDATE_APPLY_MUTABLE_KEYS) {
    if (!Object.hasOwn(data, key)) {
      continue;
    }
    if (key === 'name') {
      out.name = data.name;
    } else if (key === 'symbol') {
      out.symbol = data.symbol;
    } else if (key === 'maxSupply') {
      out.maxSupply = data.maxSupply;
    } else if (key === 'transferable') {
      out.transferable = data.transferable;
    } else if (key === 'decayInterval') {
      out.decayInterval = data.decayInterval;
    } else if (key === 'decayPercentage') {
      out.decayPercentage = data.decayPercentage;
    } else if (key === 'referencePrice') {
      out.referencePrice = data.referencePrice;
    } else if (key === 'referenceCurrency') {
      out.referenceCurrency = data.referenceCurrency;
    } else if (key === 'archiveToken') {
      out.archiveToken = data.archiveToken;
    }
  }

  if (Object.hasOwn(data, 'iconUrl')) {
    out.iconUrl = data.iconUrl;
  }

  return out;
}

/** Drop keys whose value is `undefined` so Drizzle `.set()` does not write NULLs. */
export function omitUndefinedValues<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const v = obj[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key as string] = v;
    }
  }
  return out;
}
