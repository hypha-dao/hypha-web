export const PIPELINE_SWIMLANES = [
  'Sales',
  'Investors',
  'Partners',
  'Grants',
  'Tenders',
] as const;

/** Track slug stored on deals. Space-configurable; defaults keep these values. */
export type PipelineSwimlane = string;

export const PIPELINE_STATUSES = [
  'Identified',
  'Qualified',
  'Engaged',
  'Proposal',
  'Finalizing',
  'Won',
  'Lost',
] as const;

/** Stage slug stored on deals. Space-configurable; defaults keep these values. */
export type PipelineStatus = string;

export type PipelineStageTerminal = 'won' | 'lost';

export type PipelineStageDefinition = {
  slug: string;
  name: string;
  position?: number;
  terminal?: PipelineStageTerminal;
};

export type PipelineTrackDefinition = {
  slug: string;
  name: string;
  position?: number;
};

export const DEFAULT_PIPELINE_PAGE_TITLE = 'Pipeline';
export const DEFAULT_PIPELINE_ITEM_SINGULAR = 'Opportunity';
export const DEFAULT_PIPELINE_ITEM_PLURAL = 'Opportunities';

export const DEFAULT_PIPELINE_TRACKS: PipelineTrackDefinition[] =
  PIPELINE_SWIMLANES.map((slug, position) => ({
    slug,
    name: slug,
    position,
  }));

export const DEFAULT_PIPELINE_STAGES: PipelineStageDefinition[] =
  PIPELINE_STATUSES.map((slug, position) => ({
    slug,
    name: slug,
    position,
    ...(slug === 'Won'
      ? { terminal: 'won' as const }
      : slug === 'Lost'
      ? { terminal: 'lost' as const }
      : {}),
  }));

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
  Partial<Record<string, number>>
> = { Won: 100, Lost: 0 };

export function terminalProbabilityForStage(
  stage: Pick<PipelineStageDefinition, 'slug' | 'terminal'>,
): number | undefined {
  if (stage.terminal === 'won' || stage.slug === 'Won') return 100;
  if (stage.terminal === 'lost' || stage.slug === 'Lost') return 0;
  return TERMINAL_STAGE_PROBABILITIES[stage.slug];
}

export function isTerminalWonStatus(
  status: string,
  stages?: readonly PipelineStageDefinition[],
): boolean {
  if (stages?.length) {
    return stages.some(
      (stage) =>
        stage.slug === status &&
        (stage.terminal === 'won' || stage.slug === 'Won'),
    );
  }
  return status === 'Won';
}

export function isTerminalLostStatus(
  status: string,
  stages?: readonly PipelineStageDefinition[],
): boolean {
  if (stages?.length) {
    return stages.some(
      (stage) =>
        stage.slug === status &&
        (stage.terminal === 'lost' || stage.slug === 'Lost'),
    );
  }
  return status === 'Lost';
}

export function isClosedPipelineStatus(
  status: string,
  stages?: readonly PipelineStageDefinition[],
): boolean {
  return (
    isTerminalWonStatus(status, stages) || isTerminalLostStatus(status, stages)
  );
}

export function resolveDefaultTrackSlug(
  tracks: readonly PipelineTrackDefinition[],
): PipelineSwimlane {
  return tracks[0]?.slug ?? PIPELINE_SWIMLANES[0];
}

export function resolveDefaultStageSlug(
  stages: readonly PipelineStageDefinition[],
): PipelineStatus {
  const firstOpen = [...stages]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .find((stage) => terminalProbabilityForStage(stage) === undefined);
  return firstOpen?.slug ?? stages[0]?.slug ?? PIPELINE_STATUSES[0];
}

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

export function seedStageProbability(swimlane: string, status: string): number {
  const terminal = TERMINAL_STAGE_PROBABILITIES[status];
  if (terminal !== undefined) return terminal;
  const seedLane =
    PIPELINE_PROBABILITY[swimlane as keyof typeof PIPELINE_PROBABILITY] ??
    PIPELINE_PROBABILITY.Sales;
  if (!seedLane) return 0;
  return seedLane[status as keyof typeof seedLane] ?? 0;
}

export function getDealProbability(
  swimlane: PipelineSwimlane,
  status: PipelineStatus,
  probabilities?: Record<string, Record<string, number>>,
  stages?: readonly PipelineStageDefinition[],
): number {
  const stage = stages?.find((item) => item.slug === status);
  if (stage) {
    const terminal = terminalProbabilityForStage(stage);
    if (terminal !== undefined) return terminal;
  }
  return (
    probabilities?.[swimlane]?.[status] ??
    seedStageProbability(swimlane, status)
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
  probabilities?: Record<string, Record<string, number>>,
  stages?: readonly PipelineStageDefinition[],
): number {
  return (
    deal.successRate ??
    getDealProbability(
      deal.pipelineSwimlane,
      deal.pipelineStatus,
      probabilities,
      stages,
    )
  );
}

export function getWeightedValue(
  value: number,
  swimlane: PipelineSwimlane,
  status: PipelineStatus,
  probabilities?: Record<string, Record<string, number>>,
  stages?: readonly PipelineStageDefinition[],
): number {
  return (
    (value * getDealProbability(swimlane, status, probabilities, stages)) / 100
  );
}

export function isGrantOrTenderSwimlane(swimlane: string): boolean {
  return swimlane === 'Grants' || swimlane === 'Tenders';
}
