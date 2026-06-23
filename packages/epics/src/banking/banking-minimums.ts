import type {
  BankCurrencyCode,
  BankTransferCorridorKey,
} from './bank-currency-display';
import { BANK_TRANSFER_CORRIDOR_METAS } from './bank-currency-display';
import type { PayoutCurrencyKey } from './components/payout-currency-option-row';

// ---- Deposit minimums ----

// Canonical source: payment rail → minimum fiat amount for incoming bank transfers.
export const DEPOSIT_RAIL_MINIMUMS: Record<string, string> = {
  ach_push: '1 USD',
  ach: '1 USD',
  wire: '1 USD',
  sepa: '1 EUR',
  faster_payments: '2 GBP',
  spei: '50 MXN',
  pix: '10 BRL',
  cop: '100 COP',
};

// Derived: one-time transfer corridor key → minimum (used when a specific corridor is selected).
export const DEPOSIT_CORRIDOR_MINIMUMS: Record<
  BankTransferCorridorKey,
  string
> = Object.fromEntries(
  BANK_TRANSFER_CORRIDOR_METAS.map((m) => [
    m.corridorKey,
    DEPOSIT_RAIL_MINIMUMS[m.paymentRail] ?? '',
  ]),
) as Record<BankTransferCorridorKey, string>;

// Derived: deposit currency → minimum (used when only the currency is known, not the corridor).
// Takes the first corridor found per currency — all corridors for a currency share the same minimum.
export const DEPOSIT_CURRENCY_MINIMUMS: Record<BankCurrencyCode, string> =
  Object.fromEntries(
    BANK_TRANSFER_CORRIDOR_METAS.filter(
      (m, i, arr) => arr.findIndex((x) => x.currency === m.currency) === i,
    ).map((m) => [m.currency, DEPOSIT_RAIL_MINIMUMS[m.paymentRail] ?? '']),
  ) as Record<BankCurrencyCode, string>;

// ---- Payout minimums ----

// Canonical source: payment rail → fn(sourceCurrency) → minimum USDC/EURC amount for payouts.
export const PAYOUT_RAIL_MINIMUMS: Record<
  string,
  (sourceCurrency: string) => string | null
> = {
  ach: () => '1 USDC',
  ach_push: () => '1 USDC',
  wire: () => '1 USDC',
  sepa: (src) => (src === 'eurc' ? '1 EURC' : '1 USDC'),
  faster_payments: () => '3 USDC',
};

// Payout destination currency → primary payment rail.
const PAYOUT_CURRENCY_RAIL: Partial<Record<PayoutCurrencyKey, string>> = {
  usd: 'ach',
  eur: 'sepa',
  gbp: 'faster_payments',
};

// Derived: payout destination currency + source treasury token → minimum amount.
export function getPayoutMinimum(
  currency: PayoutCurrencyKey,
  sourceCurrency: 'usdc' | 'eurc',
): string | null {
  const rail = PAYOUT_CURRENCY_RAIL[currency];
  if (!rail) return null;
  return PAYOUT_RAIL_MINIMUMS[rail]?.(sourceCurrency) ?? null;
}
