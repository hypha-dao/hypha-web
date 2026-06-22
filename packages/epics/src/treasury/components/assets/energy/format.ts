import { formatUnits } from 'viem';

export const UNAVAILABLE = '—';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Stablecoin held by the PPA (e.g. USDC, 6 decimals). */
export const formatStablecoinMicro = (value: string | null | undefined) => {
  if (value === null || value === undefined) return UNAVAILABLE;
  try {
    return Number(formatUnits(BigInt(value), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  } catch {
    return value;
  }
};

/** Signed internal settlement units on EnergyPPAv2 (plain integers). */
export const formatSignedInternal = (value: string | null | undefined) => {
  if (value === null || value === undefined) return UNAVAILABLE;
  try {
    const parsed = BigInt(value);
    const neg = parsed < 0n;
    const abs = neg ? -parsed : parsed;
    return `${neg ? '−' : ''}${abs.toLocaleString()}`;
  } catch {
    return value;
  }
};

export const formatBpsPct = (value: number | null | undefined) =>
  value === null || value === undefined
    ? UNAVAILABLE
    : `${(value / 100).toFixed(2)}%`;

export const shortAddr = (a?: string | null) =>
  !a ? UNAVAILABLE : a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

/**
 * Source ids are `bytes32` on-chain; the API tries to decode them as UTF-8 but
 * raw/binary ids decode to unreadable glyphs. Detect those and fall back to a
 * friendly "Source N" label so cards never render mojibake.
 */
export const isReadableLabel = (label: string) => {
  if (!label) return false;
  if (label.includes('\uFFFD')) return false;
  if (label.startsWith('0x')) return false;

  const printable = label.replace(/[^\x20-\x7E]/g, '');
  return printable.length >= Math.max(2, Math.floor(label.length * 0.7));
};

export const prettySourceLabel = (
  label: string,
  index: number,
  type?: string,
) => {
  if (isReadableLabel(label)) return label;
  const base =
    type && type !== 'UNKNOWN'
      ? `${type[0]}${type.slice(1).toLowerCase()}`
      : 'Source';
  return `${base} ${index + 1}`;
};

export const personDisplayName = (
  person?: {
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
  } | null,
) => {
  if (!person) return null;
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || null;
};
