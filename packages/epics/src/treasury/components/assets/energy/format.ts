import { formatUnits } from 'viem';

export const UNAVAILABLE = '—';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Stablecoin held by the PPA (e.g. EURC, 6 decimals). */
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

const titleCaseType = (type?: string) =>
  type && type !== 'UNKNOWN'
    ? `${type[0]}${type.slice(1).toLowerCase()}`
    : null;

const resolveTypeLabel = (
  type: string | undefined,
  sourceFallback: string,
  typeLabels?: { SOLAR?: string; BATTERY?: string },
) => {
  if (type === 'SOLAR' && typeLabels?.SOLAR) return typeLabels.SOLAR;
  if (type === 'BATTERY' && typeLabels?.BATTERY) return typeLabels.BATTERY;
  return titleCaseType(type) ?? sourceFallback;
};

export const prettySourceLabel = (
  label: string,
  index: number,
  type?: string,
  sourceFallback = 'Source',
  typeLabels?: { SOLAR?: string; BATTERY?: string },
) => {
  if (isReadableLabel(label)) return label;
  const typeLabel = resolveTypeLabel(type, sourceFallback, typeLabels);
  return `${typeLabel} ${index + 1}`;
};

/**
 * Display name for an energy source preferring the ownership token name, then
 * the human label, then the type (e.g. "Solar", "Battery"), then a numbered fallback.
 */
export const sourceDisplayName = (
  type?: string,
  label?: string,
  index = 0,
  sourceFallback = 'Source',
  typeLabels?: { SOLAR?: string; BATTERY?: string },
  tokenDisplayName?: string,
) => {
  if (tokenDisplayName && isReadableLabel(tokenDisplayName)) {
    return tokenDisplayName;
  }
  if (label && isReadableLabel(label)) return label;
  const typeLabel = resolveTypeLabel(type, sourceFallback, typeLabels);
  return typeLabel === sourceFallback
    ? `${sourceFallback} ${index + 1}`
    : typeLabel;
};

export const formatEnergyPricePerKwh = (internalUnits: string | number) => {
  const n =
    typeof internalUnits === 'number' ? internalUnits : Number(internalUnits);
  if (!Number.isFinite(n)) return UNAVAILABLE;
  return (n / 100).toFixed(2);
};

export const sourceCardLabel = (
  source: {
    sourceDisplayName?: string;
    sourceLabel: string;
    sourceType?: string;
  },
  index: number,
  sourceFallback = 'Source',
  typeLabels?: { SOLAR?: string; BATTERY?: string },
) => {
  if (source.sourceDisplayName && isReadableLabel(source.sourceDisplayName)) {
    return source.sourceDisplayName;
  }
  return prettySourceLabel(
    source.sourceLabel,
    index,
    source.sourceType,
    sourceFallback,
    typeLabels,
  );
};

export type EnergyParticipantProfile = {
  displayName: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  profileSlug?: string | null;
  kind?: 'person' | 'space' | 'institutional';
};

/** Merge Hypha person lookup with server-resolved participant profiles. */
export const resolveEnergyParticipantDisplay = (
  address: string,
  people: Record<
    string,
    {
      name?: string | null;
      surname?: string | null;
      nickname?: string | null;
      avatarUrl?: string | null;
    } | null
  >,
  profiles?: Record<string, EnergyParticipantProfile>,
) => {
  const key = address.toLowerCase();
  const profile = profiles?.[key];
  if (profile?.displayName) {
    return {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? undefined,
      subtitle: profile.subtitle ?? undefined,
    };
  }
  const person = people[key];
  const name = personDisplayName(person);
  if (name) {
    return {
      displayName: name,
      avatarUrl: person?.avatarUrl ?? undefined,
      subtitle: person?.nickname ? `@${person.nickname}` : undefined,
    };
  }
  return {
    displayName: shortAddr(address),
    avatarUrl: undefined,
    subtitle: shortAddr(address),
  };
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
