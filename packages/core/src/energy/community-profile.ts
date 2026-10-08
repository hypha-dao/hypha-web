import {
  ENERGY_BASE_PURPOSES,
  type EnergyBasePurpose,
} from './client/contracts';

/**
 * What Hypha can write onto Zek's `mgmt.communities` when an Enable Energy
 * Community proposal executes.
 *
 * `default_ems_objective` is a varchar. The energy system accepts these exact
 * strings. `emsObjectiveIndex` is the stable integer for that choice
 * (0 LowestPrice, 1 MaximumSelfConsumption, 2 BatteryFirst). The database
 * column stores the string; the integer travels with the proposal.
 */
export const EMS_OBJECTIVES = [
  'LowestPrice',
  'MaximumSelfConsumption',
  'BatteryFirst',
] as const;

export type EmsObjective = (typeof EMS_OBJECTIVES)[number];

export const EMS_OBJECTIVE_INDEX: Record<EmsObjective, number> = {
  LowestPrice: 0,
  MaximumSelfConsumption: 1,
  BatteryFirst: 2,
};

export const ENERGY_COMMUNITY_COUNTRIES = [
  { iso: 'AT', timeZone: 'Europe/Vienna' },
  { iso: 'FR', timeZone: 'Europe/Paris' },
  { iso: 'PT', timeZone: 'Europe/Lisbon' },
  { iso: 'ES', timeZone: 'Europe/Madrid' },
  { iso: 'NL', timeZone: 'Europe/Amsterdam' },
  { iso: 'NO', timeZone: 'Europe/Oslo' },
] as const;

export type EnergyCommunityCountryIso =
  (typeof ENERGY_COMMUNITY_COUNTRIES)[number]['iso'];

export const ENERGY_COMMUNITY_TIME_ZONES = [
  'Europe/Vienna',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Oslo',
  'UTC',
] as const;

export type EnergyCommunityTimeZone =
  (typeof ENERGY_COMMUNITY_TIME_ZONES)[number];

const COUNTRY_TIME_ZONE = new Map<string, EnergyCommunityTimeZone>(
  ENERGY_COMMUNITY_COUNTRIES.map((country) => [country.iso, country.timeZone]),
);

const COUNTRY_ISO_SET = new Set<string>(
  ENERGY_COMMUNITY_COUNTRIES.map((country) => country.iso),
);

export const timeZoneForCountry = (
  iso: string | null | undefined,
): EnergyCommunityTimeZone | null =>
  COUNTRY_TIME_ZONE.get(iso?.trim().toUpperCase() ?? '') ?? null;

/**
 * Map the on-chain primary purpose onto Zek's EMS objective.
 * `MIN_CO2` has no EMS equivalent.
 */
export const emsObjectiveFromBasePurpose = (
  purpose: string | null | undefined,
): EmsObjective | null => {
  if (purpose === 'SELF_CONSUMPTION') return 'MaximumSelfConsumption';
  if (purpose === 'LOWEST_PRICE') return 'LowestPrice';
  return null;
};

export const isEmsObjective = (value: unknown): value is EmsObjective =>
  typeof value === 'string' &&
  (EMS_OBJECTIVES as readonly string[]).includes(value);

export const onChainPurposeIndex = (
  purpose: string | null | undefined,
): number | null => {
  if (!purpose) return null;
  const index = ENERGY_BASE_PURPOSES.indexOf(purpose as EnergyBasePurpose);
  return index === -1 ? null : index;
};

export type EnergyCommunitySetup = {
  emsObjective: EmsObjective;
  /** Integer code for `emsObjective`. Written to the proposal, not the varchar column. */
  emsObjectiveIndex: number;
  /** On-chain `EnergyPPAv2.BasePurpose` integer for the primary objective. */
  onChainPurposeIndex: number | null;
  address: string;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryIso: EnergyCommunityCountryIso | null;
  timeZone: EnergyCommunityTimeZone;
  latitude: number | null;
  longitude: number | null;
};

const MARKER_START = '__hypha_energy_proposal__';
const MARKER_END = '__end_hypha_energy_proposal__';

const asTrimmed = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const asCoordinate = (
  value: unknown,
  min: number,
  max: number,
): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  return numeric;
};

const asCountry = (value: unknown): EnergyCommunityCountryIso | null => {
  if (typeof value !== 'string') return null;
  const iso = value.trim().toUpperCase();
  if (!iso || iso === 'UNSET') return null;
  return COUNTRY_ISO_SET.has(iso) ? (iso as EnergyCommunityCountryIso) : null;
};

const asTimeZone = (value: unknown): EnergyCommunityTimeZone | null => {
  if (typeof value !== 'string') return null;
  const zone = value.trim();
  return (ENERGY_COMMUNITY_TIME_ZONES as readonly string[]).includes(zone)
    ? (zone as EnergyCommunityTimeZone)
    : null;
};

const asPurposeIndex = (value: unknown): number | null => {
  if (typeof value === 'number' && ENERGY_BASE_PURPOSES[value]) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (ENERGY_BASE_PURPOSES[numeric]) return numeric;
  }
  return null;
};

export const normalizeCommunitySetup = (
  setup: Record<string, unknown>,
): EnergyCommunitySetup | null => {
  if (!isEmsObjective(setup.emsObjective)) return null;
  const address = asTrimmed(setup.address, 500);
  const timeZone = asTimeZone(setup.timeZone);
  if (!address || !timeZone) return null;

  const latitude = asCoordinate(setup.latitude, -90, 90);
  const longitude = asCoordinate(setup.longitude, -180, 180);
  if ((latitude === null) !== (longitude === null)) return null;

  return {
    emsObjective: setup.emsObjective,
    emsObjectiveIndex: EMS_OBJECTIVE_INDEX[setup.emsObjective],
    onChainPurposeIndex: asPurposeIndex(setup.onChainPurposeIndex),
    address,
    city: asTrimmed(setup.city, 200),
    region: asTrimmed(setup.region, 200),
    postalCode: asTrimmed(setup.postalCode, 20),
    countryIso: asCountry(setup.countryIso),
    timeZone,
    latitude,
    longitude,
  };
};

/**
 * Read the Enable Energy Community setup embedded in a proposal description.
 * Marker format matches `appendEnergyProposalMarker` in epics.
 */
export const readEnergyCommunitySetup = (
  description: string | null | undefined,
): EnergyCommunitySetup | null => {
  if (!description) return null;
  const end = description.lastIndexOf(MARKER_END);
  const start = description.lastIndexOf(MARKER_START, end);
  if (start === -1 || end === -1 || end <= start) return null;
  const json = description.slice(start + MARKER_START.length, end).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const payload = (parsed as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (record.contractMethod !== 'deployCommunity') return null;
  const setup = record.communitySetup;
  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return null;
  return normalizeCommunitySetup(setup as Record<string, unknown>);
};
