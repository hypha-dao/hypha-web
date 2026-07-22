export const PIPELINE_SWIMLANES = [
  'Sales',
  'Investors',
  'Partners',
  'Grants',
  'Tenders',
] as const;

export type PipelineSwimlane = (typeof PIPELINE_SWIMLANES)[number];

export const PIPELINE_STATUSES = [
  'Identified',
  'Qualified',
  'Engaged',
  'Proposal',
  'Finalizing',
  'Won',
  'Lost',
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const DEAL_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type DealPriority = (typeof DEAL_PRIORITIES)[number];

/** Common B2B contact roles for pipeline deal contacts. */
export const DEAL_CONTACT_TYPES = [
  'Decision Maker',
  'Influencer',
  'Champion',
  'Gatekeeper',
  'Other',
] as const;

export type DealContactType = (typeof DEAL_CONTACT_TYPES)[number];

export const DEAL_STATUSES = [
  'active',
  'on_hold',
  'won',
  'lost',
  'rejected',
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

/** Default region list for new spaces; spaces can customize via pipelineConfig. */
export const DEFAULT_PIPELINE_REGIONS = [
  'Benelux',
  'European Union',
  'Global',
  'Iberia',
  'Islands',
  'Nordics',
  'UK',
] as const;

/** @deprecated Prefer DEFAULT_PIPELINE_REGIONS — regions are space-configurable. */
export const REGIONS = DEFAULT_PIPELINE_REGIONS;

/** Space-configurable territory / owning-team label. */
export type Region = string;

/**
 * Terminal stages have absolute probabilities regardless of configuration:
 * a Won deal is certain, a Lost deal is not happening.
 */
export const TERMINAL_STAGE_PROBABILITIES: Readonly<
  Partial<Record<PipelineStatus, number>>
> = { Won: 100, Lost: 0 };

export const PIPELINE_PROBABILITY: Record<
  PipelineSwimlane,
  Record<PipelineStatus, number>
> = {
  Sales: {
    Identified: 5,
    Qualified: 10,
    Engaged: 25,
    Proposal: 40,
    Finalizing: 60,
    Won: 100,
    Lost: 0,
  },
  Investors: {
    Identified: 0,
    Qualified: 10,
    Engaged: 20,
    Proposal: 40,
    Finalizing: 60,
    Won: 100,
    Lost: 0,
  },
  Partners: {
    Identified: 0,
    Qualified: 10,
    Engaged: 25,
    Proposal: 50,
    Finalizing: 75,
    Won: 100,
    Lost: 0,
  },
  Grants: {
    Identified: 0,
    Qualified: 10,
    Engaged: 30,
    Proposal: 60,
    Finalizing: 80,
    Won: 100,
    Lost: 0,
  },
  Tenders: {
    Identified: 0,
    Qualified: 10,
    Engaged: 30,
    Proposal: 60,
    Finalizing: 80,
    Won: 100,
    Lost: 0,
  },
};

export const COUNTRY_GROUP_NAMES = [
  'EEA',
  'Rest of Europe',
  'Islands',
  'Americas',
  'AU/NZ',
  'Africa',
  'Asia',
] as const;

export type CountryGroupName = (typeof COUNTRY_GROUP_NAMES)[number];

export const COUNTRY_GROUPS: Record<CountryGroupName, string[]> = {
  EEA: [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'IS',
    'LI',
    'NO',
  ],
  'Rest of Europe': [
    'AL',
    'BA',
    'BY',
    'CH',
    'MD',
    'ME',
    'MK',
    'RS',
    'UA',
    'XK',
  ],
  Islands: ['FO', 'GL', 'IM', 'JE', 'GG'],
  Americas: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'CR', 'PA'],
  'AU/NZ': ['AU', 'NZ'],
  Africa: ['ZA', 'NG', 'KE', 'GH', 'EG', 'MA', 'TN', 'ET', 'RW', 'TZ'],
  Asia: [
    'CN',
    'JP',
    'KR',
    'IN',
    'SG',
    'HK',
    'TW',
    'TH',
    'VN',
    'ID',
    'MY',
    'PH',
    'AE',
    'IL',
    'TR',
  ],
};

const EEA = new Set(COUNTRY_GROUPS.EEA);
const ISLANDS = new Set(COUNTRY_GROUPS.Islands);

/** Built-in country → region suggestion (independent of space config). */
export function regionForCountry(code: string | null | undefined): Region {
  if (!code) return 'Global';
  const upper = code.toUpperCase();
  if (['NL', 'BE', 'LU'].includes(upper)) return 'Benelux';
  if (['NO', 'SE', 'DK', 'FI', 'IS', 'EE', 'LV', 'LT'].includes(upper)) {
    return 'Nordics';
  }
  if (['ES', 'PT'].includes(upper)) return 'Iberia';
  if (upper === 'GB' || upper === 'UK') return 'UK';
  if (EEA.has(upper)) return 'European Union';
  if (ISLANDS.has(upper)) return 'Islands';
  return 'Global';
}

/**
 * Resolve a region for a country against the space's configured region list.
 * Prefers the built-in suggestion when it exists in the space list.
 */
export function resolveRegionForSpace(
  code: string | null | undefined,
  regions: readonly string[],
  fallback = 'Global',
): Region {
  const list =
    regions.length > 0 ? [...regions] : [...DEFAULT_PIPELINE_REGIONS];
  // Configured region names are normalized case-insensitively; match likewise.
  const findConfigured = (name: string) =>
    list.find((region) => region.toLowerCase() === name.toLowerCase());
  const suggested = findConfigured(regionForCountry(code));
  if (suggested) return suggested;
  const fallbackMatch = findConfigured(fallback);
  if (fallbackMatch) return fallbackMatch;
  return list[0] ?? fallback;
}

export function currencyForCountry(code: string | null | undefined): string {
  if (!code) return '€';
  const upper = code.toUpperCase();
  if (['US', 'CA', 'MX', 'AU', 'NZ', 'SG', 'HK', 'TW'].includes(upper)) {
    return '$';
  }
  if (upper === 'GB' || upper === 'UK') return '£';
  if (['CH', 'LI'].includes(upper)) return 'CHF';
  if (upper === 'JP') return '¥';
  if (upper === 'CN') return '¥';
  if (upper === 'IN') return '₹';
  if (upper === 'BR') return 'R$';
  if (upper === 'TR') return '₺';
  if (upper === 'AE') return 'AED';
  if (upper === 'ZA') return 'R';
  if (EEA.has(upper) || ['NO', 'IS'].includes(upper)) return '€';
  return '€';
}

export function getDealProbability(
  swimlane: PipelineSwimlane,
  status: PipelineStatus,
  probabilities?: Record<PipelineSwimlane, Record<PipelineStatus, number>>,
): number {
  return (
    probabilities?.[swimlane]?.[status] ??
    PIPELINE_PROBABILITY[swimlane][status]
  );
}

/**
 * Success rate (%) actually used in weighted-value math: the deal's own
 * override when set, otherwise the stage default from the (space-configured)
 * probability matrix.
 */
export function effectiveSuccessRate(
  deal: {
    successRate?: number | null;
    pipelineSwimlane: PipelineSwimlane;
    pipelineStatus: PipelineStatus;
  },
  probabilities?: Record<PipelineSwimlane, Record<PipelineStatus, number>>,
): number {
  return (
    deal.successRate ??
    getDealProbability(
      deal.pipelineSwimlane,
      deal.pipelineStatus,
      probabilities,
    )
  );
}

export function getWeightedValue(
  value: number,
  swimlane: PipelineSwimlane,
  status: PipelineStatus,
  probabilities?: Record<PipelineSwimlane, Record<PipelineStatus, number>>,
): number {
  return (value * getDealProbability(swimlane, status, probabilities)) / 100;
}

export function isGrantOrTenderSwimlane(swimlane: string): boolean {
  return swimlane === 'Grants' || swimlane === 'Tenders';
}
