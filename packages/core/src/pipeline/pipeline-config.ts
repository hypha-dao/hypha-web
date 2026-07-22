import {
  DEFAULT_PIPELINE_REGIONS,
  PIPELINE_PROBABILITY,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  TERMINAL_STAGE_PROBABILITIES,
  type PipelineStatus,
  type PipelineSwimlane,
} from './constants';

/** Success probability (%) per swimlane (track) × pipeline stage. */
export type ProbabilityMatrix = Record<
  PipelineSwimlane,
  Record<PipelineStatus, number>
>;

export type PipelineConfig = {
  /** Configurable territory / owning-team labels for deals. */
  regions: string[];
  /** Preferred default when creating deals (must be in regions when set). */
  defaultRegion: string;
  /**
   * Stage default success rates (%) per swimlane. Seeds a deal's
   * successRate when it enters a stage; deals can override per deal.
   */
  probabilities: ProbabilityMatrix;
};

export function defaultProbabilityMatrix(): ProbabilityMatrix {
  const matrix = {} as ProbabilityMatrix;
  for (const swimlane of PIPELINE_SWIMLANES) {
    matrix[swimlane] = { ...PIPELINE_PROBABILITY[swimlane] };
  }
  return matrix;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  regions: [...DEFAULT_PIPELINE_REGIONS],
  defaultRegion: 'Benelux',
  probabilities: defaultProbabilityMatrix(),
};

function normalizeRegionName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

function normalizeProbability(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Normalizes a raw probability matrix, falling back to seed defaults for
 * missing/invalid cells. Terminal stages are absolute: Won=100, Lost=0.
 */
export function normalizeProbabilityMatrix(raw: unknown): ProbabilityMatrix {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const matrix = {} as ProbabilityMatrix;
  for (const swimlane of PIPELINE_SWIMLANES) {
    const rawLane =
      source[swimlane] &&
      typeof source[swimlane] === 'object' &&
      !Array.isArray(source[swimlane])
        ? (source[swimlane] as Record<string, unknown>)
        : {};
    const lane = {} as Record<PipelineStatus, number>;
    for (const status of PIPELINE_STATUSES) {
      const terminal = TERMINAL_STAGE_PROBABILITIES[status];
      if (terminal !== undefined) {
        lane[status] = terminal;
        continue;
      }
      lane[status] =
        normalizeProbability(rawLane[status]) ??
        PIPELINE_PROBABILITY[swimlane][status];
    }
    matrix[swimlane] = lane;
  }
  return matrix;
}

export function normalizePipelineConfig(raw: unknown): PipelineConfig {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const fromArray = Array.isArray(source.regions)
    ? source.regions
        .map(normalizeRegionName)
        .filter((name): name is string => Boolean(name))
    : [];

  // Dedupe case-insensitively, keep first casing.
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const name of fromArray) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(name);
  }

  const resolvedRegions =
    regions.length > 0 ? regions : [...DEFAULT_PIPELINE_REGIONS];

  const defaultCandidate = normalizeRegionName(source.defaultRegion);
  const defaultRegion =
    defaultCandidate &&
    resolvedRegions.some(
      (r) => r.toLowerCase() === defaultCandidate.toLowerCase(),
    )
      ? resolvedRegions.find(
          (r) => r.toLowerCase() === defaultCandidate.toLowerCase(),
        )!
      : resolvedRegions.includes('Benelux')
      ? 'Benelux'
      : resolvedRegions.includes('Global')
      ? 'Global'
      : resolvedRegions[0]!;

  return {
    regions: resolvedRegions,
    defaultRegion,
    probabilities: normalizeProbabilityMatrix(source.probabilities),
  };
}

export type PipelineConfigPatch = {
  regions?: string[];
  defaultRegion?: string;
  probabilities?: Partial<
    Record<PipelineSwimlane, Partial<Record<PipelineStatus, number>>>
  >;
};

/**
 * Merges a partial config update onto the current config and normalizes.
 * Sections not present in the patch are preserved.
 */
export function mergePipelineConfig(
  current: unknown,
  patch: PipelineConfigPatch,
): PipelineConfig {
  const base = normalizePipelineConfig(current);
  return normalizePipelineConfig({
    regions: patch.regions ?? base.regions,
    defaultRegion: patch.defaultRegion ?? base.defaultRegion,
    probabilities: patch.probabilities
      ? mergeProbabilities(base.probabilities, patch.probabilities)
      : base.probabilities,
  });
}

function mergeProbabilities(
  base: ProbabilityMatrix,
  patch: Partial<
    Record<PipelineSwimlane, Partial<Record<PipelineStatus, number>>>
  >,
): ProbabilityMatrix {
  const merged = {} as ProbabilityMatrix;
  for (const swimlane of PIPELINE_SWIMLANES) {
    merged[swimlane] = { ...base[swimlane], ...(patch[swimlane] ?? {}) };
  }
  return merged;
}
