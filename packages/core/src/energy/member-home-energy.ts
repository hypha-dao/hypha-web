/**
 * Figures for the member-home energy panel.
 *
 * Month charges use the member's meter kWh times the community's on-chain
 * base price. That price is stored as euro cents per kWh (the same unit the
 * energy readings poster uses). The settle amount is the outstanding
 * stablecoin debt on the energy contract, which is what a payment should cover.
 */

export type MemberEnergyBankPay = {
  paymentRail: string;
  currency: string;
  iban: string | null;
  bic: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  sortCode: string | null;
  bankName: string | null;
  accountName: string | null;
};

export type MemberEnergyHomeCommunity = {
  spaceSlug: string;
  spaceTitle: string;
  youUsedKwh: number | null;
  youMadeKwh: number | null;
  communityUsedKwh: number | null;
  communityMadeKwh: number | null;
  /** Usage this calendar month, in euros, at the community price. */
  oweThisMonth: string | null;
  /** Usage last calendar month, in euros, at the community price. */
  oweLastMonth: string | null;
  /** Outstanding debt still to pay, in euros. */
  settleAmount: string | null;
  treasuryAddress: `0x${string}` | null;
  bank: MemberEnergyBankPay | null;
};

export type MemberEnergyHomeResponse = {
  communities: MemberEnergyHomeCommunity[];
};

type MeterSeries = { meterId: number; valuesKwh: number[] };
type OwnershipBps = { ownershipBps: string };

export function seriesAt(
  values: number[] | undefined,
  index: number,
): number | null {
  if (!values || index < 0 || index >= values.length) return null;
  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function memberConsumptionKwh(
  meters: MeterSeries[],
  deviceIds: number[] | null,
  index: number,
): number | null {
  if (deviceIds == null || index < 0) return null;
  const wanted = new Set(deviceIds);
  let total = 0;
  for (const meter of meters) {
    if (!wanted.has(meter.meterId)) continue;
    const value = seriesAt(meter.valuesKwh, index);
    if (value == null) continue;
    total += value;
  }
  return Math.round(total * 100) / 100;
}

export function productionKwhAt(
  sources: Array<{ valuesKwh: number[] }>,
  index: number,
): number | null {
  if (index < 0) return null;
  if (sources.length === 0) return 0;
  let total = 0;
  let seen = false;
  for (const source of sources) {
    const value = seriesAt(source.valuesKwh, index);
    if (value == null) continue;
    total += value;
    seen = true;
  }
  if (!seen) return null;
  return Math.round(total * 100) / 100;
}

/** Share of community production this member co-owns, from 0 to 1. */
export function ownershipProductionShare(
  ownerships: OwnershipBps[],
  sourceCount: number,
): number {
  if (sourceCount <= 0 || ownerships.length === 0) return 0;
  let bps = 0;
  for (const row of ownerships) {
    const parsed = Number(row.ownershipBps);
    if (Number.isFinite(parsed) && parsed > 0) bps += parsed;
  }
  return Math.min(1, bps / (10_000 * sourceCount));
}

export function memberProductionKwh(
  communityKwh: number | null,
  share: number,
): number | null {
  if (communityKwh == null) return null;
  if (!Number.isFinite(share) || share <= 0) return 0;
  return Math.round(communityKwh * Math.min(1, share) * 100) / 100;
}

function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const frac = cents % 100n;
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}

/** `kwh` at `pricePerKwhCt` (euro cents per kWh) as a euro string. */
export function oweEurosFromKwh(
  kwh: number | null,
  pricePerKwhCt: bigint | null,
): string | null {
  if (
    kwh == null ||
    !Number.isFinite(kwh) ||
    pricePerKwhCt == null ||
    pricePerKwhCt <= 0n
  ) {
    return null;
  }
  const milli = BigInt(Math.max(0, Math.round(kwh * 1000)));
  const cents = (milli * pricePerKwhCt) / 1000n;
  return formatCents(cents);
}

/** Stablecoin micro-units (6 decimals) as a euro string. Null when unknown. */
export function formatStablecoinMicro(
  micro: string | null | undefined,
): string | null {
  if (micro == null || micro === '') return null;
  let amount: bigint;
  try {
    amount = BigInt(micro);
  } catch {
    return null;
  }
  if (amount <= 0n) return '0.00';
  const cents = (amount + 5_000n) / 10_000n;
  return formatCents(cents);
}

export function buildMemberEnergyFigures(input: {
  telemetryEnabled: boolean;
  consumptionKwh: number[];
  consumptionByMeter: MeterSeries[];
  productionBySource: Array<{ valuesKwh: number[] }>;
  deviceIds: number[] | null;
  ownerships: OwnershipBps[];
  sourceCount: number;
  pricePerKwhCt: bigint | null;
  debtMicro: string | null;
}): Pick<
  MemberEnergyHomeCommunity,
  | 'youUsedKwh'
  | 'youMadeKwh'
  | 'communityUsedKwh'
  | 'communityMadeKwh'
  | 'oweThisMonth'
  | 'oweLastMonth'
  | 'settleAmount'
> {
  const settleAmount = formatStablecoinMicro(input.debtMicro);
  if (!input.telemetryEnabled) {
    return {
      youUsedKwh: null,
      youMadeKwh: null,
      communityUsedKwh: null,
      communityMadeKwh: null,
      oweThisMonth: null,
      oweLastMonth: null,
      settleAmount,
    };
  }

  const current = input.consumptionKwh.length - 1;
  const previous = current - 1;
  const communityUsedKwh = seriesAt(input.consumptionKwh, current);
  const communityMadeKwh = productionKwhAt(input.productionBySource, current);
  const share = ownershipProductionShare(input.ownerships, input.sourceCount);
  const youUsedKwh = memberConsumptionKwh(
    input.consumptionByMeter,
    input.deviceIds,
    current,
  );
  const youUsedLast = memberConsumptionKwh(
    input.consumptionByMeter,
    input.deviceIds,
    previous,
  );

  return {
    youUsedKwh,
    youMadeKwh: memberProductionKwh(communityMadeKwh, share),
    communityUsedKwh,
    communityMadeKwh,
    oweThisMonth: oweEurosFromKwh(youUsedKwh, input.pricePerKwhCt),
    oweLastMonth: oweEurosFromKwh(youUsedLast, input.pricePerKwhCt),
    settleAmount,
  };
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function walletQrPayload(
  address: string | null | undefined,
): string | null {
  if (!address || !ADDRESS_RE.test(address)) return null;
  return address;
}

function epcName(name: string): string {
  const cleaned = name
    .replace(/[^\u0020-\u00ff]/g, '')
    .replace(/[\r\n]/g, ' ')
    .trim()
    .slice(0, 70);
  return cleaned || 'Space';
}

/** SEPA EPC QR when an IBAN is active, otherwise the account number. */
export function bankQrPayload(
  bank: MemberEnergyBankPay | null,
  amountEur: string | null,
  beneficiary: string,
): string | null {
  if (!bank) return null;
  const iban = bank.iban?.replace(/\s+/g, '').toUpperCase() ?? '';
  if (bank.paymentRail === 'sepa' && iban) {
    const amount =
      amountEur && /^\d+\.\d{2}$/.test(amountEur) && amountEur !== '0.00'
        ? `EUR${amountEur}`
        : '';
    const bic = (bank.bic ?? '').replace(/\s+/g, '').toUpperCase();
    return [
      'BCD',
      '002',
      '1',
      'SCT',
      bic,
      epcName(beneficiary),
      iban,
      amount,
      '',
      '',
    ].join('\n');
  }
  const account = bank.accountNumber ?? (iban || null);
  return account;
}

type BankAccountLike = {
  status: string;
  paymentRail: string;
  currency: string;
  depositInstructions: Record<string, unknown>;
};

function instructionString(
  instructions: Record<string, unknown>,
  key: string,
): string | null {
  const value = instructions[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function pickActivatedBankAccount(
  accounts: BankAccountLike[],
): MemberEnergyBankPay | null {
  const activated = accounts.filter(
    (account) => account.status.trim().toLowerCase() === 'activated',
  );
  const preferred =
    activated.find((account) => account.paymentRail === 'sepa') ?? activated[0];
  if (!preferred) return null;
  const read = (key: string) =>
    instructionString(preferred.depositInstructions, key);
  const pay: MemberEnergyBankPay = {
    paymentRail: preferred.paymentRail,
    currency: preferred.currency,
    iban: read('iban'),
    bic: read('bic'),
    accountNumber: read('bank_account_number') ?? read('account_number'),
    routingNumber: read('bank_routing_number'),
    sortCode: read('sort_code'),
    bankName: read('bank_name'),
    accountName:
      read('account_holder_name') ??
      read('account_name') ??
      read('bank_beneficiary_name'),
  };
  if (!pay.iban && !pay.accountNumber) return null;
  return pay;
}
